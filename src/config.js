/* アプリの設定値（科目・初期値など）。ここを書き換えると初期状態が変わります。
   ※ 一度アプリで設定を保存したブラウザでは、保存済みの値（localStorage）が優先されます。 */
export const APP_CONFIG = {
  // 設定の初期値
  DEFAULTS: {
    focus: 25, // 集中（分）
    short: 5, // 小休憩（分）
    long: 15, // 長休憩（分）
    longEvery: 4, // 何回ごとに長休憩
    weeklyGoalH: 15, // 週の目標（時間）
    autoBreak: false, // 休憩を自動開始
    subjects: ['応用情報', '簿記論', '財務諸表論', 'その他'], // 科目
    bgFocus: 'snow', // 集中中の背景
    bgBreak: 'fire', // 休憩中の背景
    bgSpeed: 50, // 背景アニメの速さ
    fireworks: true, // 完了時の花火
    keepAwake: true, // タイマー中は画面を点けたままにする
  },
  // 科目の色（科目の並び順に割り当て）
  COLORS: ['#2F4BB8', '#1C8A6E', '#C2731A', '#8A4FB8', '#B83F5E', '#3F7FA6', '#7A8A2E', '#8C6E5A'],
  // モード表示名
  MODE_LABEL: { focus: '集中', short: '小休憩', long: '長休憩' },
  // localStorage のキー（変えると既存データが読めなくなるので注意）
  LS_DATA: 'pomo.data.v1',
  LS_TIMER: 'pomo.timer.v1',
  LS_LOOK: 'pomo.look.v1',
  LS_DRAWER: 'pomo.drawer.v1',
};
