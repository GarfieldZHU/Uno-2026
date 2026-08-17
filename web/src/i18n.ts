import { PROFILE_OPTIONS } from "./types";

export type Language = "zh" | "en";

type UiCopy = {
  menuEyebrow: string;
  menuTitle: string;
  menuSubtitle: string;
  startGame: string;
  settings: string;
  about: string;
  statusOffline: string;
  statusOnlineLocked: string;
  closeSettings: string;
  settingsEyebrow: string;
  settingsTitle: string;
  settingsLede: string;
  saveSettings: string;
  aboutEyebrow: string;
  aboutTitle: string;
  aboutBody: string;
  memorialLink: string;
  aboutStatus: string;
  closeAbout: string;
  offlineTable: string;
  quietTable: string;
  rustRuntime: string;
  offline: string;
  online: string;
  locked: string;
  switchToEnglish: string;
  switchToChinese: string;
  setupEyebrow: string;
  setupTitle: string;
  setupTitleAccent: string;
  setupLede: string;
  deterministicCore: string;
  noNetwork: string;
  startingLineup: string;
  setTable: string;
  players: string;
  playerCountLabel: string;
  youAiSeats: string;
  playerOption: (count: number) => string;
  aiProfile: string;
  aiProfileLabel: string;
  appliesToEveryAi: string;
  defaultAiPause: string;
  defaultAiPauseLabel: string;
  secondsBetweenMoves: string;
  seatRhythm: string;
  individualOverrides: string;
  setAllTo: (seconds: number) => string;
  youHuman: string;
  ready: string;
  aiPause: (seconds: number) => string;
  startOffline: string;
  rustLocal: string;
  onlineRoomsLocked: string;
  match: string;
  seats: (count: number) => string;
  makeYourMove: string;
  turn: string;
  yourMove: string;
  nextPlayer: string;
  thinking: (name: string) => string;
  tableComplete: string;
  activeColor: string;
  drawPile: string;
  discard: string;
  ruleset: string;
  tableSignal: string;
  engine: string;
  network: string;
  disabled: string;
  onlineNote: string;
  oneCardLeft: string;
  callUno: string;
  drawCard: string;
  clickHint: string;
  drawHint: string;
  playableHint: string;
  wildCard: string;
  chooseColor: string;
  wildExplanation: string;
  cancel: string;
  viewDiscardHistory: string;
  closeDiscardHistory: string;
  discardHistoryTitle: string;
  latestCard: string;
  tableUnavailable: string;
  retryTable: string;
  loading: string;
  loadingAssets: string;
  loadingAssetsDetail: (loaded: number, total: number) => string;
  networkLog: string;
  networkLogDone: string;
  networkLogHint: string;
  gameRecord: string;
  gameRecordHint: string;
  gameRecordTitle: string;
  gameRecordSummary: (count: number) => string;
  noGameRecord: string;
  replayRecord: string;
  replaying: string;
  exportRecord: string;
  recordExported: string;
  closeRecord: string;
  dealingDetail: (playerCount: number) => string;
  startingWith: (name: string) => string;
  playBegins: string;
  youWin: string;
  youLose: string;
  winnerSubtitle: (name: string) => string;
  winnerLabel: string;
  ai: string;
  human: string;
  basePause: (seconds: number) => string;
  cards: (count: number, unoCalled: boolean) => string;
};

const COPY: Record<Language, UiCopy> = {
  zh: {
    menuEyebrow: "UNO-2026 / 1411",
    menuTitle: "开始一局 UNO",
    menuSubtitle: "一张为纪念而重做的离线 UNO 牌桌。Rust 负责规则，WASM 让它留在你的浏览器里。",
    startGame: "开始游戏",
    settings: "设置",
    about: "关于",
    statusOffline: "离线 · Rust / WASM",
    statusOnlineLocked: "联机 · 房间可用",
    closeSettings: "关闭设置",
    settingsEyebrow: "牌桌偏好 / 1411",
    settingsTitle: "设置你的节奏",
    settingsLede: "人数、AI 档位和每一次出牌之间的停顿，都只影响本地牌局。",
    saveSettings: "保存设置",
    aboutEyebrow: "一段牌桌的来路",
    aboutTitle: "给旧代码的一次回声",
    aboutBody: "UNO-2026 纪念 1411-duliu/Uno 那个陈旧的 C++ UNO 项目。规则在 Rust 中重新整理，界面换成可缩放的网页牌桌；原仓库仍是本项目的历史参考，不复制它的专有图像。",
    memorialLink: "查看原版仓库",
    aboutStatus: "当前版本：离线可玩 · 联机房间首版",
    closeAbout: "关闭关于",
    offlineTable: "离线牌桌",
    quietTable: "一张安静、每一手都值得记住的牌桌",
    rustRuntime: "Rust 核心 · WASM 运行时",
    offline: "离线",
    online: "联机",
    locked: "已锁定",
    switchToEnglish: "切换到英文",
    switchToChinese: "切换到中文",
    setupEyebrow: "牌桌设置 / 1411",
    setupTitle: "发一桌",
    setupTitleAccent: "值得记住的牌。",
    setupLede: "由 Rust 引擎驱动的本地 UNO 牌桌。选择人数，调好节奏，让每一步都留在你的设备上。",
    deterministicCore: "确定性核心",
    noNetwork: "无需网络",
    startingLineup: "开局阵容",
    setTable: "设置牌桌",
    players: "玩家",
    playerCountLabel: "玩家",
    youAiSeats: "你 + AI 席位",
    playerOption: (count) => `${count} 名玩家`,
    aiProfile: "AI 档位",
    aiProfileLabel: "AI 档位",
    appliesToEveryAi: "应用到所有 AI 席位",
    defaultAiPause: "AI 默认停顿",
    defaultAiPauseLabel: "AI 默认停顿",
    secondsBetweenMoves: "出牌间隔（秒）",
    seatRhythm: "席位节奏",
    individualOverrides: "单独调整",
    setAllTo: (seconds) => `全部设为 ${seconds} 秒`,
    youHuman: "你 / 人类",
    ready: "就绪",
    aiPause: (seconds) => `AI / ${seconds} 秒停顿`,
    startOffline: "开始离线牌局",
    rustLocal: "Rust / WASM 在本地运行。联机房间使用独立 Rust 服务。",
    onlineRoomsLocked: "联机房间已提供首版流程；需要配置 Rust 服务地址。",
    match: "牌局",
    seats: (count) => `${count} 席`,
    makeYourMove: "轮到你出牌。",
    turn: "回合",
    yourMove: "你的回合",
    nextPlayer: "下一位出牌",
    thinking: (name) => `${name} 思考中`,
    tableComplete: "牌局结束",
    activeColor: "当前颜色",
    drawPile: "摸牌堆",
    discard: "弃牌",
    ruleset: "规则 / 经典 + UNO 喊牌",
    tableSignal: "牌桌信号",
    engine: "引擎",
    network: "网络",
    disabled: "未启用",
    onlineNote: "联机房间使用 Rust 服务，房间状态短期保存在内存中。",
    oneCardLeft: "只剩一张。",
    callUno: "喊 UNO",
    drawCard: "摸一张牌",
    clickHint: "点击亮起的牌出牌",
    drawHint: "没有可出牌时摸牌",
    playableHint: "可出的牌会在手牌轨道上发光。",
    wildCard: "万能牌",
    chooseColor: "选择下一个颜色。",
    wildExplanation: "牌桌会按照你的选择继续。",
    cancel: "取消",
    viewDiscardHistory: "查看已打出的牌",
    closeDiscardHistory: "关闭已打出的牌",
    discardHistoryTitle: "已打出的牌",
    latestCard: "最新",
    tableUnavailable: "牌桌暂时不可用",
    retryTable: "重试牌桌",
    loading: "正在洗牌…",
    loadingAssets: "正在加载牌桌资源…",
    loadingAssetsDetail: (loaded, total) => `牌面与桌景 ${loaded}/${total}`,
    networkLog: "导出网络日志",
    networkLogDone: "网络日志已导出",
    networkLogHint: "导出脱敏的 WebSocket 与网络性能日志",
    gameRecord: "局内记录",
    gameRecordHint: "查看、回放或导出本局记录",
    gameRecordTitle: "本局记录",
    gameRecordSummary: (count) => `已记录 ${count} 个状态节点，可用于复盘。`,
    noGameRecord: "等待牌桌产生第一条记录。",
    replayRecord: "回放",
    replaying: "回放中…",
    exportRecord: "导出记录",
    recordExported: "已导出",
    closeRecord: "关闭局内记录",
    dealingDetail: (playerCount) => `${playerCount} 位玩家 · 手牌已准备，正在发到牌桌`,
    startingWith: (name) => `从 ${name} 开始`,
    playBegins: "请留意当前回合。",
    youWin: "恭喜，你赢了！",
    youLose: "这局惜败",
    winnerSubtitle: (name) => `${name} 清空了手牌。下一局再来一把。`,
    winnerLabel: "本局获胜者",
    ai: "AI",
    human: "人类",
    basePause: (seconds) => `${seconds} 秒基础停顿`,
    cards: (count, unoCalled) => `${count} 张牌${unoCalled ? " · 已喊 UNO" : ""}`,
  },
  en: {
    menuEyebrow: "UNO-2026 / 1411",
    menuTitle: "Start a UNO game",
    menuSubtitle: "An offline UNO table rebuilt as a small memorial. Rust owns the rules; WASM keeps the match in your browser.",
    startGame: "Start game",
    settings: "Settings",
    about: "About",
    statusOffline: "OFFLINE · RUST / WASM",
    statusOnlineLocked: "ONLINE · ROOMS OPEN",
    closeSettings: "Close settings",
    settingsEyebrow: "TABLE PREFERENCES / 1411",
    settingsTitle: "Set your rhythm",
    settingsLede: "Room size, AI profile, and the pause between moves stay local to this table.",
    saveSettings: "Save settings",
    aboutEyebrow: "A TABLE WITH A MEMORY",
    aboutTitle: "An echo for the old code",
    aboutBody: "UNO-2026 remembers the old C++ UNO project at 1411-duliu/Uno. Its rules are reorganized in Rust and its surface becomes a scalable web table; the original repository remains a historical reference, not a source for proprietary artwork.",
    memorialLink: "Open the original repository",
    aboutStatus: "Current build: playable offline · first online room slice",
    closeAbout: "Close about",
    offlineTable: "OFFLINE TABLE",
    quietTable: "A quiet table for loud plays",
    rustRuntime: "Rust core · WASM runtime",
    offline: "OFFLINE",
    online: "ONLINE",
    locked: "LOCKED",
    switchToEnglish: "Switch to English",
    switchToChinese: "Switch to Chinese",
    setupEyebrow: "TABLE SETUP / 1411",
    setupTitle: "Deal a table",
    setupTitleAccent: "worth remembering.",
    setupLede: "A local UNO table powered by the Rust engine. Choose the room size, tune the rhythm, and keep every move on your machine.",
    deterministicCore: "DETERMINISTIC CORE",
    noNetwork: "NO NETWORK REQUIRED",
    startingLineup: "STARTING LINEUP",
    setTable: "Set the table.",
    players: "PLAYERS",
    playerCountLabel: "Player count",
    youAiSeats: "YOU + AI SEATS",
    playerOption: (count) => `${count} players`,
    aiProfile: "AI PROFILE",
    aiProfileLabel: "AI profile",
    appliesToEveryAi: "APPLIES TO EVERY AI SEAT",
    defaultAiPause: "DEFAULT AI PAUSE",
    defaultAiPauseLabel: "Default AI pause",
    secondsBetweenMoves: "SECONDS BETWEEN MOVES",
    seatRhythm: "SEAT RHYTHM",
    individualOverrides: "INDIVIDUAL OVERRIDES",
    setAllTo: (seconds) => `SET ALL TO ${seconds}S`,
    youHuman: "YOU / HUMAN",
    ready: "READY",
    aiPause: (seconds) => `AI / ${seconds}s pause`,
    startOffline: "START OFFLINE TABLE",
    rustLocal: "Rust / WASM stays local. Online rooms use a separate Rust service.",
    onlineRoomsLocked: "Online rooms are available as a first slice; configure the Rust service origin.",
    match: "MATCH",
    seats: (count) => `${count} SEATS`,
    makeYourMove: "Make your move.",
    turn: "TURN",
    yourMove: "YOUR MOVE",
    nextPlayer: "NEXT TO PLAY",
    thinking: (name) => `${name.toUpperCase()} IS THINKING`,
    tableComplete: "TABLE COMPLETE",
    activeColor: "ACTIVE COLOR",
    drawPile: "DRAW PILE",
    discard: "DISCARD",
    ruleset: "RULESET / CLASSIC + UNO CALL",
    tableSignal: "TABLE SIGNAL",
    engine: "ENGINE",
    network: "NETWORK",
    disabled: "DISABLED",
    onlineNote: "Online rooms use a Rust service and short-lived in-memory room state.",
    oneCardLeft: "One card left.",
    callUno: "CALL UNO",
    drawCard: "DRAW CARD",
    clickHint: "a lit card to play",
    drawHint: "when no move is open",
    playableHint: "A playable card glows on the rail.",
    wildCard: "WILD CARD",
    chooseColor: "Name the next color.",
    wildExplanation: "The table will continue with your choice.",
    cancel: "Cancel",
    viewDiscardHistory: "View played cards",
    closeDiscardHistory: "Close played cards",
    discardHistoryTitle: "Played cards",
    latestCard: "LATEST",
    tableUnavailable: "Table unavailable",
    retryTable: "Retry table",
    loading: "Shuffling the Rust table…",
    loadingAssets: "Loading table assets…",
    loadingAssetsDetail: (loaded, total) => `Cards and table ${loaded}/${total}`,
    networkLog: "Export network log",
    networkLogDone: "Network log exported",
    networkLogHint: "Export redacted WebSocket and network performance logs",
    gameRecord: "Match record",
    gameRecordHint: "Review, replay, or export this match",
    gameRecordTitle: "Match record",
    gameRecordSummary: (count) => `${count} state nodes recorded for replay.`,
    noGameRecord: "The first table event will appear here.",
    replayRecord: "Replay",
    replaying: "Replaying…",
    exportRecord: "Export record",
    recordExported: "Exported",
    closeRecord: "Close match record",
    dealingDetail: (playerCount) => `${playerCount} players · hands are moving to the table`,
    startingWith: (name) => `Starting with ${name}`,
    playBegins: "Watch the active turn.",
    youWin: "You win!",
    youLose: "Not this time",
    winnerSubtitle: (name) => `${name} emptied their hand. Deal again when you are ready.`,
    winnerLabel: "WINNER",
    ai: "AI",
    human: "HUMAN",
    basePause: (seconds) => `${seconds}s BASE PAUSE`,
    cards: (count, unoCalled) => `${count} cards${unoCalled ? " · UNO" : ""}`,
  },
};

export function copy(language: Language) {
  return COPY[language];
}

export function profileLabel(language: Language, value: string) {
  const option = PROFILE_OPTIONS.find((candidate) => candidate.value === value);
  if (!option || language === "en") return option?.label ?? value;
  const suffix: Record<string, string> = {
    "garfield1993-ai-simple": "简单",
    "garfield1993-ai-hard": "困难",
    "uno-2026-ai-easy": "入门",
    "uno-2026-ai-strategist": "策略",
  };
  return `${value.startsWith("garfield1993") ? "garfield1993" : "uno-2026"} · ${suffix[value] ?? option.label}`;
}

export function profileHint(language: Language, value: string) {
  if (language === "en") return PROFILE_OPTIONS.find((option) => option.value === value)?.hint ?? "";
  const hints: Record<string, string> = {
    "garfield1993-ai-simple": "先出第一张合法牌",
    "garfield1993-ai-hard": "施加功能牌压力",
    "uno-2026-ai-easy": "节奏清晰易读",
    "uno-2026-ai-strategist": "颜色与威胁评分",
  };
  return hints[value] ?? "";
}

export function translateColor(language: Language, color: string) {
  if (language === "en") return color;
  return ({ Red: "红色", Yellow: "黄色", Green: "绿色", Blue: "蓝色", Wild: "万能" } as Record<string, string>)[color] ?? color;
}

export function translateCardLabel(language: Language, label: string) {
  if (language === "en") return label;
  return ({ SKIP: "跳过", "↻": "反转", WILD: "万能" } as Record<string, string>)[label] ?? label;
}

export function localizeEngineMessage(language: Language, message: string) {
  if (language === "en") return message;
  if (message === "Your turn. Match the color or symbol.") return "轮到你了。匹配颜色或牌型出牌。";
  if (message === "You drew a playable card. Play it or pass.") return "你摸到了一张可出的牌。可以出牌，也可以跳过。";
  const draw = message.match(/^(.*) draws (\d+) cards?\.$/);
  if (draw) return `${draw[1]} 摸了 ${draw[2]} 张牌。`;
  const singleDraw = message.match(/^(.*) draws a card\.$/);
  if (singleDraw) return `${singleDraw[1]} 摸了一张牌。`;
  const missedUno = message.match(/^(.*) missed UNO and draws 2\.$/);
  if (missedUno) return `${missedUno[1]} 漏喊 UNO，摸两张牌。`;
  const calledUno = message.match(/^(.*) called UNO!$/);
  if (calledUno) return `${calledUno[1]} 喊了 UNO！`;
  const choseColor = message.match(/^(.*) chose (Red|Yellow|Green|Blue)\.$/);
  if (choseColor) return `${choseColor[1]} 选择了${translateColor(language, choseColor[2])}。`;
  const played = message.match(/^(.*) played (.+)\.$/);
  if (played) return `${played[1]} 打出了 ${translateCardLabel(language, played[2])}。`;
  const winner = message.match(/^(.*) wins the table!$/);
  if (winner) return `${winner[1]} 赢得了牌局！`;
  return message;
}
