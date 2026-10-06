/* 設定のタブ: 設定の保存と、バックアップの書き出し・取り込み */
import { dayKey } from '../core/time.js';
import { settingsFromForm } from '../core/settings.js';
import { backupJson, parseBackup } from '../core/backup.js';
import { $, saveFile } from './dom.js';

let ctx;
const S = () => ctx.store.state;

export function init(c) {
  ctx = c;
  $('sSave').onclick = () => {
    const next = settingsFromForm(S().settings, {
      focus: $('sFocus').value,
      short: $('sShort').value,
      long: $('sLong').value,
      longEvery: $('sEvery').value,
      weeklyGoalH: $('sGoal').value,
      autoBreak: $('sAuto').checked,
      subjects: $('sSubjects').value,
      bgFocus: $('sBgFocus').value,
      bgBreak: $('sBgBreak').value,
      bgSpeed: $('sBgSpeed').value,
      fireworks: $('sFireworks').checked,
    });
    ctx.store.setSettings(next);
    ctx.renderAll();
    renderSettings();
    ctx.bgInit();
    ctx.toast('設定を保存しました');
  };
  $('sBgSpeed').oninput = () => ($('sBgSpeedOut').textContent = $('sBgSpeed').value + '%');

  $('btnExport').onclick = () => {
    const { settings, months, tasks } = S();
    if (
      saveFile(
        'focus-timer-backup-' + dayKey(Date.now()) + '.json',
        backupJson({ settings, months, tasks }, Date.now()),
        'application/json',
      )
    )
      ctx.toast('書き出しました');
  };
  $('btnImport').onclick = () => $('importFile').click();
  $('importFile').onchange = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const r = parseBackup(await f.text());
    if (!r.ok) {
      ctx.toast(
        r.error === 'json'
          ? 'ファイルを読み込めませんでした（JSON形式ではありません）'
          : 'このアプリのバックアップファイルではありません',
      );
      return;
    }
    const { added, tAdded } = ctx.store.importBackup(r.data);
    renderSettings();
    ctx.toast('記録' + added + '件、タスク' + tAdded + '件を取り込みました');
  };
}

export function renderSettings() {
  const settings = S().settings;
  $('sFocus').value = settings.focus;
  $('sShort').value = settings.short;
  $('sLong').value = settings.long;
  $('sEvery').value = settings.longEvery;
  $('sAuto').checked = !!settings.autoBreak;
  $('sGoal').value = settings.weeklyGoalH;
  $('sSubjects').value = settings.subjects.join('\n');
  $('sBgFocus').value = settings.bgFocus;
  $('sBgBreak').value = settings.bgBreak;
  $('sBgSpeed').value = settings.bgSpeed;
  $('sBgSpeedOut').textContent = settings.bgSpeed + '%';
  $('sFireworks').checked = !!settings.fireworks;
}
