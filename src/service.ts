// Runs secclaw in the background and starts it on boot/login: systemd (Linux), launchd (macOS), Startup folder (Windows).
import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform, userInfo } from "node:os";
import { dirname, join } from "node:path";
import { DATA, ROOT } from "./config.js";

const NODE = process.execPath;
const MAIN = join(ROOT, "dist", "main.js");
const ENV = join(ROOT, ".env");
const LOG = join(DATA, "secclaw.log");
const run = (cmd: string) => execSync(cmd, { stdio: "inherit" });

function linux() {
  if (!existsSync("/run/systemd/system")) return "systemd not found. Start manually with: npm start";
  writeFileSync(
    "/tmp/secclaw.service",
    `[Unit]
Description=secclaw personal agent
After=network-online.target
Wants=network-online.target

[Service]
User=${userInfo().username}
WorkingDirectory=${ROOT}
Environment=PATH=${process.env.PATH}
ExecStart=${NODE} --env-file=${ENV} ${MAIN}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
`,
  );
  run("sudo mv /tmp/secclaw.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable secclaw && sudo systemctl restart secclaw");
  return "Running as a systemd service.\nLogs: journalctl -u secclaw -f\nStop: sudo systemctl disable --now secclaw";
}

function mac() {
  const plist = join(homedir(), "Library/LaunchAgents/com.secclaw.agent.plist");
  mkdirSync(dirname(plist), { recursive: true });
  writeFileSync(
    plist,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.secclaw.agent</string>
  <key>ProgramArguments</key><array><string>${NODE}</string><string>--env-file=${ENV}</string><string>${MAIN}</string></array>
  <key>WorkingDirectory</key><string>${ROOT}</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>${process.env.PATH}</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${LOG}</string>
  <key>StandardErrorPath</key><string>${LOG}</string>
</dict></plist>
`,
  );
  run(`launchctl unload "${plist}" 2>/dev/null; launchctl load -w "${plist}"`);
  return `Running as a launchd agent.\nLogs: tail -f "${LOG}"\nStop: launchctl unload -w "${plist}"`;
}

function windows() {
  const pid = join(DATA, "secclaw.pid");
  try {
    process.kill(Number(readFileSync(pid, "utf8"))); // stop a previous instance so two bots don't poll at once
  } catch {}
  const cmd = join(DATA, "run.cmd");
  writeFileSync(cmd, `@echo off\r\ncd /d "${ROOT}"\r\n"${NODE}" --env-file=.env dist\\main.js >> "${LOG}" 2>&1\r\n`);
  const vbs = join(process.env.APPDATA!, "Microsoft", "Windows", "Start Menu", "Programs", "Startup", "secclaw.vbs");
  writeFileSync(vbs, `CreateObject("WScript.Shell").Run """${cmd}""", 0, False\r\n`); // 0 = hidden window
  spawn("wscript", [vbs], { detached: true, stdio: "ignore" }).unref();
  return `Running hidden in the background, and starts at login.\nLogs: ${LOG}\nStop: end "Node.js" in Task Manager. Disable: delete ${vbs}`;
}

const installers: Record<string, () => string> = { linux, darwin: mac, win32: windows };

export const installService = () => installers[platform()]?.() ?? "Unsupported OS. Start manually with: npm start";
