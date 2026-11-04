// MAANAS Mind Check — question bank.
// Items are original wording written for this prototype. It is a self-reflection
// screener, NOT a diagnostic instrument. Every item uses the same 0–3 scale and
// refers to the last two weeks.

export const SCALE = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' },
];

export const SPECIALITIES = {
  anxiety: 'Stress & anxiety',
  mood: 'Low mood',
  overthinking: 'Overthinking & rumination',
  sleep: 'Sleep & routines',
  focus: 'Focus & student wellbeing',
  connection: 'Relationships & loneliness',
};

export const SECTIONS = [
  {
    key: 'mood',
    title: 'Mood',
    intro: 'How your general mood has been.',
    weight: 1.2,
    items: [
      { id: 'm1', text: 'Feeling down, low or flat for most of the day' },
      { id: 'm2', text: 'Losing interest in things you usually enjoy' },
      { id: 'm3', text: "Feeling that you're not good enough or are letting people down" },
      { id: 'm4', text: 'Finding it hard to feel hopeful about the coming weeks' },
    ],
  },
  {
    key: 'anxiety',
    title: 'Worry & tension',
    intro: 'Stress, nervousness and how your body reacts to it.',
    weight: 1.1,
    items: [
      { id: 'a1', text: 'Feeling nervous, tense or on edge' },
      { id: 'a2', text: 'Worrying about many different things and finding it hard to stop' },
      { id: 'a3', text: 'Physical signs of stress such as a racing heart, tight chest or restlessness' },
      { id: 'a4', text: 'Expecting that something bad is about to happen' },
    ],
  },
  {
    key: 'overthinking',
    title: 'Overthinking',
    intro: 'How often thoughts loop or get stuck.',
    weight: 1.2,
    items: [
      { id: 'o1', text: 'Replaying conversations or situations over and over in your head' },
      { id: 'o2', text: "Getting stuck analysing a decision long after you'd like to move on" },
      { id: 'o3', text: "Thinking “what if…” about things that haven't happened" },
      { id: 'o4', text: 'Overthinking stopping you from starting or finishing tasks' },
    ],
  },
  {
    key: 'sleep',
    title: 'Sleep & energy',
    intro: 'Rest, sleep and day-time energy.',
    weight: 0.9,
    items: [
      { id: 's1', text: "Trouble falling or staying asleep because your mind won't switch off" },
      { id: 's2', text: 'Waking up still feeling tired' },
      { id: 's3', text: 'Feeling drained of energy during the day' },
    ],
  },
  {
    key: 'focus',
    title: 'Focus & clear thinking',
    intro: 'Concentration and putting thoughts into words.',
    weight: 1.0,
    items: [
      { id: 'f1', text: 'Finding it hard to concentrate on reading, study or work' },
      { id: 'f2', text: 'Struggling to put your thoughts into clear, short words' },
      { id: 'f3', text: 'Losing track of what you were doing or saying' },
    ],
  },
  {
    key: 'connection',
    title: 'Connection',
    intro: 'Feeling supported by the people around you.',
    weight: 0.8,
    items: [
      { id: 'c1', text: 'Feeling lonely or disconnected from others' },
      { id: 'c2', text: 'Feeling that there is no one you can talk to openly' },
    ],
  },
];

// Safety item: never scored into the index — it only drives the crisis-support pathway.
export const SAFETY_ITEM = {
  id: 'x1',
  text: 'Thoughts that you would be better off not being here, or of hurting yourself',
};

export const CRISIS_RESOURCES = [
  { name: 'Tele-MANAS (Govt. of India, 24×7, free)', phone: '14416', alt: '1-800-891-4416' },
  { name: 'Emergency services', phone: '112' },
];

export const ALL_ITEM_IDS = [...SECTIONS.flatMap((s) => s.items.map((i) => i.id)), SAFETY_ITEM.id];
