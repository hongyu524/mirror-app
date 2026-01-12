import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../contexts/AuthContext.native';
import { useTheme } from '../contexts/ThemeContext.native';
import { useLanguage } from '../contexts/LanguageContext.native';
import { getThemeColors } from '../lib/themeColors';
import { getEmotionEmoji, getEmotionColor, EMOTIONS_GROUPED } from '../lib/emotions';
import { Picker } from '@react-native-picker/picker';
import { deleteMediaItem } from '../utils/deleteMedia';
import { db, storage } from '../firebase/firebaseConfig';
import { collection, getDocs, orderBy, query, doc, deleteDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRefFB, deleteObject } from 'firebase/storage';

type Attachment = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  storage_path?: string; // firebase storage path (preferred)
  media_doc_id?: string; // firestore doc id if different from id
  downloadURL?: string;
  eventId?: string | null;
};

type Contact = {
  id: string;
  name: string;
  tag?: string | null;
  notes?: string | null;
};

type Event = {
  id: string;
  title?: string;
  description?: string | null;
  startAt?: Date;
  what_happened?: string;
  notes?: string;
  tags?: string[];
  contactIds?: string[];
  primary_emotion?: string | null;
  emotion_intensity?: number | null;
  color?: string | null;
  contact?: Contact;
  contact_id?: string;
  attachments?: Attachment[];
  event_date?: string;
};

type EventWithContact = Event;

export function Timeline() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { resolvedTheme } = useTheme();
  const colors = getThemeColors(resolvedTheme === 'light');
  const [events, setEvents] = useState<EventWithContact[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EventWithContact[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState('');
  const [selectedEmotion, setSelectedEmotion] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [showEmotionDropdown, setShowEmotionDropdown] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<LightboxMedia | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [events, searchQuery, selectedContact, selectedEmotion]);

  const loadData = async () => {
    setLoading(true);
    if (!user) {
      setEvents([]);
      setContacts([]);
      setLoading(false);
      return;
    }
    try {
      const uid = user.uid;
      const eventsCol = collection(db, 'users', uid, 'events');
      const contactsCol = collection(db, 'users', uid, 'contacts');

      const [eventsSnap, contactsSnap] = await Promise.all([
        getDocs(query(eventsCol, orderBy('startAt', 'desc'))),
        getDocs(query(contactsCol, orderBy('name'))),
      ]);

      const contactsData: Contact[] = contactsSnap.docs.map((d) => ({
        id: d.id,
        name: d.data().name || '',
        tag: d.data().tag || null,
        notes: d.data().notes || null,
      }));

      const eventsData: EventWithContact[] = await Promise.all(eventsSnap.docs.map(async (d) => {
        const e = d.data();
        const start = e.startAt?.toDate ? e.startAt.toDate() : e.startAt ? new Date(e.startAt) : null;
        const contactId = (e.contactIds && e.contactIds[0]) || e.contact_id || null;
        const contact = contactId ? contactsData.find((c) => c.id === contactId) : undefined;
        // fetch attachments from subcollection
        const attSnap = await getDocs(collection(db, 'users', uid, 'events', d.id, 'attachments'));
        const attachments: Attachment[] = attSnap.docs.map((a) => {
          const ad = a.data() as any;
          return {
            id: a.id,
            file_name: ad.fileName || ad.file_name || '',
            file_path: ad.storagePath || ad.file_path || '',
            file_type: ad.contentType || ad.file_type || '',
            file_size: ad.size || ad.file_size || 0,
            storage_path: ad.storagePath || ad.file_path || '',
            media_doc_id: a.id,
            downloadURL: ad.downloadUrl || ad.downloadURL,
            eventId: d.id,
          };
        });
        return {
          id: d.id,
          title: e.title || '',
          description: e.description || '',
          what_happened: e.what_happened || e.description || e.title || '',
          notes: e.notes || '',
          tags: e.tags || [],
          contactIds: e.contactIds || (contactId ? [contactId] : []),
          contact_id: contactId || undefined,
          contact,
          primary_emotion: e.primaryEmotion || e.primary_emotion || e.emotion || e.emotionName || null,
          emotion_intensity: e.emotionIntensity ?? e.emotion_intensity ?? null,
          color: e.moodColor || e.color || null,
          event_date: start ? start.toISOString() : undefined,
          attachments,
        };
      }));

      setContacts(contactsData);
      setEvents(eventsData);
    } catch (err) {
      console.error('Failed to load Firestore data', err);
      setEvents([]);
      setContacts([]);
    }
    setLoading(false);
  };

  const handleDeleteAttachment = async (eventId: string, attachment: Attachment) => {
    if (!user) {
      Alert.alert(t('common.error'), t('common.pleaseLogin'));
      return;
    }

    const storagePath = attachment.storage_path || attachment.file_path;
    const docId = attachment.media_doc_id || attachment.id;

    if (!storagePath) {
      Alert.alert('Delete failed', 'Cannot delete: missing storage path (legacy item).');
      return;
    }

    if (!storagePath.startsWith('users/')) {
      Alert.alert('Delete failed', 'Cannot delete legacy attachment (non-Firebase path).');
      return;
    }

    const prevEvents = [...events];
    // Optimistic remove
    setEvents((curr) =>
      curr.map((ev) =>
        ev.id === eventId
          ? { ...ev, attachments: ev.attachments?.filter((att) => att.id !== attachment.id) || [] }
          : ev
      )
    );

    try {
      await deleteMediaItem({ id: docId, uid: user.uid, storagePath });
    } catch (err) {
      console.error('Delete media failed', err);
      Alert.alert('Delete failed', 'Could not delete media. Restoring item.');
      // Restore
      setEvents(prevEvents);
    }
  };

  const applyFilters = () => {
    let filtered = [...events];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((event) => {
        const what = (event.what_happened || '').toString().toLowerCase();
        const notes = (event.notes || '').toString().toLowerCase();
        const tagsMatch = event.tags?.some((tag) => (tag || '').toString().toLowerCase().includes(query)) || false;
        const contactName = (event.contact?.name || '').toString().toLowerCase();
        return what.includes(query) || notes.includes(query) || tagsMatch || contactName.includes(query);
      });
    }

    if (selectedContact) {
      filtered = filtered.filter((event) => event.contact_id === selectedContact);
    }

    if (selectedEmotion) {
      filtered = filtered.filter((event) => event.primary_emotion === selectedEmotion);
    }

    setFilteredEvents(filtered);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getAllEmotions = () => {
    const emotions: { emoji: string; value: string }[] = [];
    Object.values(EMOTIONS_GROUPED).forEach((group) => {
      emotions.push(...group);
    });
    return emotions;
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!user) {
      Alert.alert(t('common.error'), t('common.pleaseLogin'));
      return;
    }

    Alert.alert(
      'Delete Moment',
      'Are you sure you want to delete this moment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const uid = user.uid;
              const eventDocRef = doc(db, 'users', uid, 'events', eventId);
              const attachmentsCol = collection(db, 'users', uid, 'events', eventId, 'attachments');
              const attSnap = await getDocs(attachmentsCol);

              await Promise.all(attSnap.docs.map(async (att) => {
                const data = att.data() as any;
                const storagePath = data.storagePath || data.file_path;
                if (storagePath) {
                  try {
                    await deleteObject(storageRefFB(storage, storagePath));
                  } catch (err) {
                    console.warn('Failed to delete storage object', storagePath, err);
                  }
                }
                try {
                  await deleteDoc(att.ref);
                } catch (err) {
                  console.warn('Failed to delete attachment doc', att.id, err);
                }
              }));

              await deleteDoc(eventDocRef);
              setEvents(prev => prev.filter(e => e.id !== eventId));
            } catch (err) {
              console.error('Failed to delete event', err);
              Alert.alert(t('common.error'), 'Could not delete this moment. Please try again.');
            } finally {
              loadData();
            }
          }
        }
      ]
    );
  };

  const isImageAttachment = (attachment: Attachment) => {
    const type = attachment.file_type?.toLowerCase() || '';
    const name = attachment.file_name?.toLowerCase() || '';
    const byMime = type.startsWith('image/');
    const byExt = /\.(jpg|jpeg|png|heic|heif|webp)$/i.test(name);
    return byMime || byExt;
  };

  const isVideoAttachment = (attachment: Attachment) => {
    const type = attachment.file_type?.toLowerCase() || '';
    const name = attachment.file_name?.toLowerCase() || '';
    const byMime = type.startsWith('video/');
    const byExt = /\.(mp4|mov|m4v|avi|webm)$/i.test(name);
    return byMime || byExt;
  };

  const encodeUrl = (url: string) => {
    if (!url) return '';
    try {
      return encodeURI(url);
    } catch {
      return url;
    }
  };

  const downloadFile = async (attachment: Attachment) => {
    try {
      const url = attachment.downloadURL || (attachment.storage_path
        ? await getDownloadURL(storageRefFB(storage, attachment.storage_path))
        : attachment.file_path
          ? await getDownloadURL(storageRefFB(storage, attachment.file_path))
          : '');
      if (!url) throw new Error('No download URL for this file');
      const fileUri = FileSystem.documentDirectory + attachment.file_name;
      const downloadResult = await FileSystem.downloadAsync(url, fileUri);
      if (downloadResult.uri && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadResult.uri);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      Alert.alert('Error', 'Failed to download file');
    }
  };

  const getFileUrl = async (attachment: Attachment): Promise<string> => {
    const direct = attachment.downloadURL || attachment.downloadUrl;
    if (direct) return direct;
    const filePath = attachment.storage_path || attachment.file_path;
    if (!filePath) return '';
    try {
      return await getDownloadURL(storageRefFB(storage, filePath));
    } catch (err) {
      console.error('Failed to get download URL', err);
      return '';
    }
  };

  type LightboxMedia =
    | { kind: 'image'; url: string; fileName: string; attachment: Attachment }
    | { kind: 'video'; url: string; fileName: string; attachment: Attachment };

  const openMediaLightbox = async (attachment: Attachment) => {
    const url = await getFileUrl(attachment);
    if (!url) return;
    if (isVideoAttachment(attachment)) {
      setLightboxImage({ kind: 'video', url, fileName: attachment.file_name, attachment });
    } else {
      setLightboxImage({ kind: 'image', url, fileName: attachment.file_name, attachment });
    }
  };

  const AttachmentPreview = ({ attachment }: { attachment: Attachment }) => {
    const [url, setUrl] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [retried, setRetried] = useState(false);
    const isImage = isImageAttachment(attachment);
    const isVideo = isVideoAttachment(attachment);

    useEffect(() => {
      const load = async () => {
        setLoading(true);
        setError(false);
        setRetried(false);
        const signed = await getFileUrl(attachment);
        setUrl(signed);
        setLoading(false);
      };
      load();
    }, [attachment.file_path, attachment.storage_path, attachment.downloadURL, attachment.downloadUrl]);

    if (loading || !url || error) {
      return (
        <View style={styles.attachmentPlaceholder}>
          <Feather name={isVideo ? "video" : "image"} size={24} color="#9ca3af" />
        </View>
      );
    }

    if (isVideo) {
      return (
        <View style={styles.attachmentVideoContainer}>
          <Video
            source={{ uri: url }}
            style={styles.attachmentVideo}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls={false}
            isLooping
            shouldPlay={false}
            onError={() => {
              if (!retried && url) {
                setRetried(true);
                setError(false);
                return;
              }
              setError(true);
            }}
          />
          <View style={styles.videoOverlay}>
            <Feather name="play" size={20} color="#fff" />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.attachmentImageContainer}>
        <Image
          source={{ uri: url }}
          style={styles.attachmentImage}
          resizeMode="cover"
          onError={() => {
            if (!retried && url) {
              setRetried(true);
              setError(false);
              return;
            }
            setError(true);
          }}
        />
        <Text style={styles.attachmentFileName} numberOfLines={1}>{attachment.file_name}</Text>
      </View>
    );
  };

  const renderEvent = (event: EventWithContact, index: number) => {
    const eventDate = new Date(event.event_date);
    const today = new Date();
    const isToday = eventDate.toDateString() === today.toDateString();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const isYesterday = eventDate.toDateString() === yesterday.toDateString();

    let dateLabel = '';
    if (isToday) {
      dateLabel = t('timeline.today');
    } else if (isYesterday) {
      dateLabel = t('timeline.yesterday');
    } else {
      dateLabel = eventDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: eventDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }

    const showDateHeader = index === 0 ||
      new Date(filteredEvents[index - 1].event_date).toDateString() !== eventDate.toDateString();

    const emotionRaw = event.primary_emotion || (event as any).emotion || (event as any).emotionName || null;
    const emotionName = emotionRaw
      ? emotionRaw.charAt(0).toUpperCase() + emotionRaw.slice(1)
      : t('timeline.unknownEmotion') || 'Unknown';

    const contactName = event.contact?.name || t('timeline.unknownContact') || 'Unknown';
    const contactInitial = contactName && contactName.length > 0 ? contactName.charAt(0).toUpperCase() : '?';

    return (
      <View key={`${event.id}-${index}`}>
        {showDateHeader && (
          <Text style={[styles.dateHeader, { color: colors.textSecondary }]}>{dateLabel}</Text>
        )}
        <View style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.eventCardTopBorder, { backgroundColor: event.color || '#3b82f6' }]} />
          <View style={styles.eventCardContent}>
            <View style={styles.eventHeader}>
              <View style={styles.eventHeaderLeft}>
                <View style={[styles.contactAvatar, { backgroundColor: colors.backgroundSecondary }]}>
                  <Text style={[styles.contactAvatarText, { color: colors.textSecondary }]}>
                    {contactInitial}
                  </Text>
                </View>
                <Text style={[styles.contactName, { color: colors.text }]}>{contactName}</Text>
              </View>
              <View style={styles.eventHeaderRight}>
                <Text style={[styles.eventDate, { color: colors.textTertiary }]}>{formatDate(event.event_date)}</Text>
                <TouchableOpacity
                  onPress={() => handleDeleteEvent(event.id)}
                  style={styles.deleteButton}
                >
                  <Feather name="trash-2" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[styles.eventText, { color: colors.textSecondary }]}>{event.what_happened}</Text>

            <View style={[styles.emotionBadge, { backgroundColor: colors.backgroundSecondary, borderColor: (event.color || '#3b82f6') + '80' }]}>
              <Text style={styles.emotionEmoji}>{getEmotionEmoji(emotionRaw)}</Text>
              <Text style={[styles.emotionName, { color: event.color || '#3b82f6' }]}>
                {emotionName}
              </Text>
              <Text style={[styles.emotionSeparator, { color: colors.textTertiary }]}>•</Text>
              <View style={styles.intensityDots}>
                {Array.from({ length: event.emotion_intensity }).map((_, i) => (
                  <View
                    key={i}
                    style={[styles.intensityDot, { backgroundColor: event.color || '#3b82f6' }]}
                  />
                ))}
              </View>
            </View>

            {event.notes && (
              <View style={[styles.notesContainer, { borderTopColor: colors.border }]}>
                <Text style={[styles.notesText, { color: colors.textTertiary }]}>{event.notes}</Text>
              </View>
            )}

            {event.tags && event.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {event.tags.map((tag) => (
                  <View key={tag} style={[styles.tag, { backgroundColor: colors.backgroundSecondary }]}>
                    <Text style={[styles.tagText, { color: colors.textTertiary }]}>#{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            {event.attachments && event.attachments.length > 0 && (
              <View style={[styles.attachmentsContainer, { borderTopColor: colors.border }]}>
                <Text style={[styles.attachmentsLabel, { color: colors.textTertiary }]}>
                  {t('timeline.attachments')} ({event.attachments.length})
                </Text>
                <View style={styles.attachmentsGrid}>
                  {event.attachments.map((attachment, attIdx) => {
                    const isMedia = isImageAttachment(attachment) || isVideoAttachment(attachment);
                    return (
                      <TouchableOpacity
                        key={attachment.id || `${event.id}-att-${attIdx}`}
                        onPress={() => (isMedia ? openMediaLightbox(attachment) : downloadFile(attachment))}
                        style={styles.attachmentItem}
                        activeOpacity={0.7}
                      >
                        {isMedia ? (
                          <AttachmentPreview attachment={attachment} />
                        ) : (
                          <View style={[styles.attachmentFileContainer, { backgroundColor: colors.backgroundSecondary + '80' }]}>
                            <Feather name="file" size={32} color={colors.textTertiary} />
                            <View style={styles.attachmentFileInfo}>
                              <Text style={[styles.attachmentFileName, { color: colors.textSecondary }]} numberOfLines={1}>
                                {attachment.file_name}
                              </Text>
                              <Text style={[styles.attachmentFileSize, { color: colors.textTertiary }]}>
                                {(attachment.file_size / 1024).toFixed(1)} KB
                              </Text>
                            </View>
                            <Feather name="download" size={16} color={colors.textTertiary} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{t('timeline.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('timeline.subtitle')}</Text>
        </View>

        <View style={styles.filtersContainer}>
          <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={20} color={colors.textTertiary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={t('timeline.search')}
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.filterRow}>
            <View style={styles.pickerWrapper}>
              <TouchableOpacity
                onPress={() => {
                  setShowContactDropdown(true);
                  setShowEmotionDropdown(false);
                }}
                style={[styles.pickerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerText, { color: colors.text }]}>
                  {selectedContact ? contacts.find(c => c.id === selectedContact)?.name || t('timeline.allPeople') : t('timeline.allPeople')}
                </Text>
                <Feather name="chevron-down" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerWrapper}>
              <TouchableOpacity
                onPress={() => {
                  setShowEmotionDropdown(true);
                  setShowContactDropdown(false);
                }}
                style={[styles.pickerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerText, { color: colors.text }]}>
                  {selectedEmotion ? t(`emotion.${selectedEmotion}`) : t('timeline.allEmotions')}
                </Text>
                <Feather name="chevron-down" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#60a5fa" />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('common.loading')}</Text>
          </View>
        ) : filteredEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              {events.length === 0 ? t('timeline.noData') : t('timeline.noResults')}
            </Text>
          </View>
        ) : (
          <View style={styles.eventsContainer}>
            {filteredEvents.map((event, index) => renderEvent(event, index))}
          </View>
        )}
      </ScrollView>

      {/* Contact Dropdown Modal */}
      <Modal
        visible={showContactDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContactDropdown(false)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setShowContactDropdown(false)}
        >
          <View style={[styles.dropdownContainer, { backgroundColor: colors.card, borderColor: colors.border }]} onStartShouldSetResponder={() => true}>
            <ScrollView style={styles.dropdownList} nestedScrollEnabled>
              <TouchableOpacity
                onPress={() => {
                  setSelectedContact('');
                  setShowContactDropdown(false);
                }}
                style={[styles.dropdownItem, { borderBottomColor: colors.border }, !selectedContact && styles.dropdownItemSelected]}
              >
                <Text style={[styles.dropdownItemText, { color: colors.text }, !selectedContact && styles.dropdownItemTextSelected]}>
                  {t('timeline.allPeople')}
                </Text>
                {!selectedContact && <Feather name="check" size={16} color="#60a5fa" />}
              </TouchableOpacity>
              {contacts.map((contact) => (
                <TouchableOpacity
                  key={contact.id}
                  onPress={() => {
                    setSelectedContact(contact.id);
                    setShowContactDropdown(false);
                  }}
                  style={[styles.dropdownItem, { borderBottomColor: colors.border }, selectedContact === contact.id && styles.dropdownItemSelected]}
                >
                  <Text style={[styles.dropdownItemText, { color: colors.text }, selectedContact === contact.id && styles.dropdownItemTextSelected]}>
                    {contact.name}
                  </Text>
                  {selectedContact === contact.id && <Feather name="check" size={16} color="#60a5fa" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Emotion Dropdown Modal */}
      <Modal
        visible={showEmotionDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmotionDropdown(false)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setShowEmotionDropdown(false)}
        >
          <View style={[styles.dropdownContainer, { backgroundColor: colors.card, borderColor: colors.border }]} onStartShouldSetResponder={() => true}>
            <ScrollView style={styles.dropdownList} nestedScrollEnabled>
              <TouchableOpacity
                onPress={() => {
                  setSelectedEmotion('');
                  setShowEmotionDropdown(false);
                }}
                style={[styles.dropdownItem, { borderBottomColor: colors.border }, !selectedEmotion && styles.dropdownItemSelected]}
              >
                <Text style={[styles.dropdownItemText, { color: colors.text }, !selectedEmotion && styles.dropdownItemTextSelected]}>
                  {t('timeline.allEmotions')}
                </Text>
                {!selectedEmotion && <Feather name="check" size={16} color="#60a5fa" />}
              </TouchableOpacity>
              {getAllEmotions().map((emotion) => (
                <TouchableOpacity
                  key={emotion.value}
                  onPress={() => {
                    setSelectedEmotion(emotion.value);
                    setShowEmotionDropdown(false);
                  }}
                  style={[styles.dropdownItem, { borderBottomColor: colors.border }, selectedEmotion === emotion.value && styles.dropdownItemSelected]}
                >
                  <Text style={[styles.dropdownItemText, { color: colors.text }, selectedEmotion === emotion.value && styles.dropdownItemTextSelected]}>
                    {emotion.emoji} {t(`emotion.${emotion.value}`)}
                  </Text>
                  {selectedEmotion === emotion.value && <Feather name="check" size={16} color="#60a5fa" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={!!lightboxImage}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxImage(null)}
      >
        <TouchableOpacity
          style={styles.lightboxOverlay}
          activeOpacity={1}
          onPress={() => setLightboxImage(null)}
        >
          <View style={styles.lightboxContent}>
            <View style={styles.lightboxHeader}>
              <TouchableOpacity
                onPress={() => setLightboxImage(null)}
                style={styles.lightboxButton}
              >
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {lightboxImage && (
              <>
                {lightboxImage.kind === 'video' ? (
                  <Video
                    source={{ uri: lightboxImage.url }}
                    style={styles.lightboxVideo}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay
                  />
                ) : (
                  <Image
                    source={{ uri: lightboxImage.url }}
                    style={styles.lightboxImage}
                    resizeMode="contain"
                  />
                )}
                <Text style={styles.lightboxFileName}>{lightboxImage.fileName}</Text>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 200,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '300',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  filtersContainer: {
    marginBottom: 24,
    gap: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerWrapper: {
    flex: 1,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  pickerText: {
    fontSize: 16,
    flex: 1,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContainer: {
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 400,
    width: '80%',
    overflow: 'hidden',
  },
  dropdownList: {
    maxHeight: 400,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  dropdownItemSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  dropdownItemText: {
    fontSize: 16,
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: '#60a5fa',
    fontWeight: '500',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 16,
  },
  eventsContainer: {
    gap: 16,
  },
  dateHeader: {
    fontSize: 18,
    fontWeight: '500',
    marginTop: 24,
    marginBottom: 12,
  },
  eventCard: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  eventCardTopBorder: {
    height: 4,
    width: '100%',
  },
  eventCardContent: {
    padding: 20,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 16,
  },
  eventHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  contactAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: {
    fontSize: 14,
    fontWeight: '500',
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
  },
  eventHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventDate: {
    fontSize: 14,
  },
  deleteButton: {
    padding: 4,
  },
  eventText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  emotionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  emotionEmoji: {
    fontSize: 18,
  },
  emotionName: {
    fontSize: 14,
    fontWeight: '500',
  },
  emotionSeparator: {
    fontSize: 14,
  },
  intensityDots: {
    flexDirection: 'row',
    gap: 4,
  },
  intensityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  notesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  notesText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 12,
  },
  attachmentsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  attachmentsLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  attachmentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  attachmentItem: {
    flex: 1,
    minWidth: '45%',
  },
  attachmentImageContainer: {
    width: '100%',
  },
  attachmentImage: {
    width: '100%',
    height: 96,
    borderRadius: 8,
  },
  attachmentVideoContainer: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  attachmentVideo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  attachmentFileName: {
    fontSize: 12,
    marginTop: 4,
  },
  attachmentPlaceholder: {
    width: '100%',
    height: 96,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
  },
  attachmentFileInfo: {
    flex: 1,
    minWidth: 0,
  },
  attachmentFileSize: {
    fontSize: 12,
    marginTop: 2,
  },
  attachmentItemWrapper: {
    position: 'relative',
    flex: 1,
    minWidth: '45%',
  },
  attachmentDelete: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 6,
    borderRadius: 14,
    zIndex: 5,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  lightboxHeader: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    gap: 16,
    padding: 16,
    zIndex: 10,
  },
  lightboxButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: {
    width: '100%',
    maxWidth: '100%',
    height: '85%',
    maxHeight: '85%',
  },
  lightboxVideo: {
    width: '100%',
    maxWidth: '100%',
    height: '85%',
    maxHeight: '85%',
  },
  lightboxFileName: {
    color: '#fff',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
});
