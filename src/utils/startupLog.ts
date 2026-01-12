let logs: string[] = [];

export function logStartup(msg: string) {
  const line = `[STARTUP] ${new Date().toISOString()} ${msg}`;
  logs.push(line);
  // keep last 200 to avoid unbounded growth
  if (logs.length > 200) logs = logs.slice(-200);
  console.log(line);
}

export function getStartupLogs() {
  return logs.slice(-50).join('\n');
}
