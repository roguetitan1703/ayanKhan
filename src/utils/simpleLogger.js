import fs from "fs";
import path from "path";

const logFilePath = path.join(process.cwd(), "logs", "spribe.log");

export function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFilePath, logMessage, "utf8");
}
