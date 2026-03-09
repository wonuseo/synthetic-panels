const TAB_GROUP_DEFAULT_TAB = {
  summary: 'overview',
  funnel: 'upper',
  'survey-overview': 'survey',
  qa: 'qa',
  individual: 'individual',
};
const tabSelection = { ...TAB_GROUP_DEFAULT_TAB };

function setActiveGroup(groupKey) {
  const groupBar = document.getElementById('tab-group-bar');
  const subBar = document.getElementById('tab-sub-bar');
  if (!groupBar || !subBar) return;

  groupBar.querySelectorAll('.tab-group-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.group === groupKey);
  });
  subBar.querySelectorAll('.tab-sub-group').forEach(group => {
    group.classList.toggle('active', group.dataset.group === groupKey);
  });

  const activeSubGroup = subBar.querySelector(`.tab-sub-group[data-group="${groupKey}"]`);
  const subTabCount = activeSubGroup ? activeSubGroup.querySelectorAll('.tab-btn').length : 0;
  subBar.classList.toggle('collapsed', subTabCount <= 1);
}

export function setActiveTab(tabKey, { syncGroup = true } = {}) {
  const btn = document.querySelector(`.tab-btn[data-tab="${tabKey}"]`);
  const panel = document.getElementById(`tab-${tabKey}`);
  if (!btn || !panel) return;

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  panel.classList.add('active');

  const groupKey = btn.closest('.tab-sub-group')?.dataset.group;
  if (!groupKey) return;

  tabSelection[groupKey] = tabKey;
  if (syncGroup) setActiveGroup(groupKey);
}

export function activateGroup(groupKey) {
  setActiveGroup(groupKey);
  const subgroup = document.querySelector(`.tab-sub-group[data-group="${groupKey}"]`);
  if (!subgroup) return;

  const preferredTab = tabSelection[groupKey] || TAB_GROUP_DEFAULT_TAB[groupKey];
  const fallbackTab = subgroup.querySelector('.tab-btn')?.dataset.tab;
  const targetTab = preferredTab || fallbackTab;
  if (!targetTab) return;

  setActiveTab(targetTab, { syncGroup: false });
}

export function resetTabHierarchy() {
  Object.assign(tabSelection, TAB_GROUP_DEFAULT_TAB);
  activateGroup('summary');
}

export function initTabController() {
  document.getElementById('tab-group-bar')?.addEventListener('click', e => {
    const btn = e.target.closest('.tab-group-btn');
    if (!btn) return;
    const group = btn.dataset.group;
    if (!group) return;
    activateGroup(group);
  });

  document.getElementById('tab-sub-bar')?.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const tab = btn.dataset.tab;
    if (!tab) return;
    setActiveTab(tab);
  });
}
