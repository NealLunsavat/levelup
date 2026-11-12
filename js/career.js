// The Career Skill Tree: real-life milestones that unlock new quest packs.
// A node can only be unlocked once its parent is unlocked and its requirements are met.

export const CAREER_NODES = [
  {
    id: 'certified', name: 'Certified', icon: '🎓', parent: null,
    requires: [{ attr: 'int', level: 10, label: 'INT Level 10' }, { flag: 'examPassedOn', label: 'Pass the NASM CPT exam' }],
    unlocks: 'Equinox Job Hunt quests', pack: 'jobhunt',
  },
  {
    id: 'floor', name: 'The Floor', icon: '🏟️', parent: 'certified',
    requires: [{ flag: 'jobSecuredOn', label: 'Equinox job secured' }],
    unlocks: 'Floor Interaction dailies', pack: 'floor',
  },
  {
    id: 'book', name: 'Book of Business', icon: '📒', parent: 'floor',
    requires: [{ count: 'clients', target: 5, label: '5 IRL clients' }],
    unlocks: 'The Online Brand quests', pack: 'brand',
  },
  {
    id: 'program', name: 'The 8-Week Program', icon: '🚀', parent: 'book',
    requires: [{ attr: 'cha', level: 15, label: 'CHA Level 15' }],
    unlocks: 'High-ticket online sales quests', pack: 'sales',
  },
];

// Daily quest packs a node unlocks. `skill` decides which attribute they train.
export const CAREER_PACKS = {
  jobhunt: {
    name: 'Equinox Job Hunt', icon: '🎓', skill: 'finance',
    quests: [
      { id: 'jh-apply', title: 'Apply to or message 1 Equinox club' },
      { id: 'jh-resume', title: 'Polish your trainer résumé or LinkedIn' },
      { id: 'jh-practice', title: 'Run a practice assessment on a friend' },
      { id: 'jh-visit', title: 'Visit a club and meet the fitness manager' },
    ],
  },
  floor: {
    name: 'Floor Interaction', icon: '🏟️', skill: 'content',
    quests: [
      { id: 'fl-convos', title: 'Start 3 conversations with members' },
      { id: 'fl-assess', title: 'Offer 1 complimentary assessment' },
      { id: 'fl-book', title: 'Book 1 consultation' },
      { id: 'fl-follow', title: 'Follow up with yesterday’s contacts' },
    ],
  },
  brand: {
    name: 'The Online Brand', icon: '📱', skill: 'content',
    quests: [
      { id: 'br-post', title: 'Post 1 fitness reel or short' },
      { id: 'br-film', title: 'Film B-roll in Apple Log 2' },
      { id: 'br-edit', title: 'Edit and color grade 1 video in DaVinci' },
      { id: 'br-reply', title: 'Reply to every comment and DM' },
    ],
  },
  sales: {
    name: 'High-Ticket Sales', icon: '💎', skill: 'finance',
    quests: [
      { id: 'sa-dms', title: 'Send 5 outreach DMs to warm leads' },
      { id: 'sa-book', title: 'Book 1 sales call' },
      { id: 'sa-call', title: 'Run 1 sales call for the 8-Week Program' },
      { id: 'sa-proof', title: 'Post 1 client result or testimonial' },
    ],
  },
};

// Each node's state: unlocked | ready (can unlock now) | available (parent done, requirements pending) | locked.
export function evaluateCareer(career, attributes) {
  const levels = Object.fromEntries(attributes.map(a => [a.id, a.level]));
  const unlocked = career.unlocked ?? {};
  const nodes = CAREER_NODES.map(n => {
    const requires = n.requires.map(r => {
      if (r.attr) return { ...r, value: levels[r.attr], target: r.level, done: levels[r.attr] >= r.level };
      if (r.flag) return { ...r, done: !!career[r.flag] };
      const value = Number(career[r.count]) || 0;
      return { ...r, value, done: value >= r.target };
    });
    const parentDone = !n.parent || !!unlocked[n.parent];
    let status = 'locked';
    if (unlocked[n.id]) status = 'unlocked';
    else if (parentDone) status = requires.every(r => r.done) ? 'ready' : 'available';
    return { ...n, requires, status, unlockedAt: unlocked[n.id] ?? null };
  });
  return { nodes, packs: nodes.filter(n => n.status === 'unlocked').map(n => ({ id: n.pack, ...CAREER_PACKS[n.pack] })) };
}
