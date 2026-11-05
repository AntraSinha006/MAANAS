// MAANAS Mind Check — question bank.
// Items are original wording written for this prototype. It is a self-reflection
// screener, NOT a diagnostic instrument. Each item has four options (A–D) scored 0–3.

/** Fallback scale — only used if an item has no per-item options array. */
export const SCALE = [
  { value: 0, label: 'A' },
  { value: 1, label: 'B' },
  { value: 2, label: 'C' },
  { value: 3, label: 'D' },
];

export const SPECIALITIES = {
  anxiety:      'Stress & anxiety',
  mood:         'Low mood & emotional wellbeing',
  overthinking: 'Overthinking & rumination',
  sleep:        'Sleep & routines',
  focus:        'Energy & motivation',
  connection:   'Relationships & loneliness',
  self:         'Self-worth & confidence',
};

export const SECTIONS = [
  {
    key: 'mood',
    title: 'The world around you',
    intro: 'How you experience the world and positive moments.',
    weight: 1.1,
    items: [
      {
        id: 'w1',
        text: 'When you look at the sky, what do you usually notice?',
        options: [
          { value: 0, label: 'Its colours, light or clouds, and it lifts my mood' },
          { value: 1, label: 'I notice it sometimes, with no strong feeling' },
          { value: 2, label: 'It looks plain or grey, whatever the weather' },
          { value: 3, label: "I don't look up anymore, or it feels heavy and meaningless" },
        ],
      },
      {
        id: 'w2',
        text: 'If your current mood were weather, it would be:',
        options: [
          { value: 0, label: 'Mostly sunny' },
          { value: 1, label: 'Partly cloudy' },
          { value: 2, label: 'Overcast for days' },
          { value: 3, label: "A storm that won't end, or fog with no visibility" },
        ],
      },
      {
        id: 'w3',
        text: 'Think about a place you love. How does it feel when you imagine it now?',
        options: [
          { value: 0, label: 'Warm and inviting' },
          { value: 1, label: 'Pleasant, but less vivid than before' },
          { value: 2, label: 'Faded, like an old photograph' },
          { value: 3, label: 'Nothing, I feel no pull toward anything' },
        ],
      },
      {
        id: 'w4',
        text: 'When something good happens, what is your first reaction?',
        options: [
          { value: 0, label: 'Genuine happiness' },
          { value: 1, label: 'Happy, but it fades quickly' },
          { value: 2, label: '"It won\'t last" or "I don\'t deserve it"' },
          { value: 3, label: 'I feel nothing, or I distrust it' },
        ],
      },
    ],
  },
  {
    key: 'self',
    title: 'Yourself',
    intro: 'How you see and judge yourself.',
    weight: 1.2,
    items: [
      {
        id: 's1',
        text: 'When you look in the mirror (literally or in your mind), what do you tend to see?',
        options: [
          { value: 0, label: 'Someone who is okay, with strengths and flaws' },
          { value: 1, label: 'Someone average, sometimes self-critical' },
          { value: 2, label: 'Mostly my failures and shortcomings' },
          { value: 3, label: 'Someone I dislike or feel ashamed of' },
        ],
      },
      {
        id: 's2',
        text: 'What does your inner voice sound like?',
        options: [
          { value: 0, label: 'Like a supportive friend' },
          { value: 1, label: 'Neutral, occasionally harsh' },
          { value: 2, label: 'A critic that often puts me down' },
          { value: 3, label: 'A harsh judge that is constantly against me' },
        ],
      },
      {
        id: 's3',
        text: 'If a friend made the same mistake you made, how would you judge them compared with yourself?',
        options: [
          { value: 0, label: 'About the same, kindly' },
          { value: 1, label: 'Slightly harder on myself' },
          { value: 2, label: 'Much harder on myself' },
          { value: 3, label: "I'd forgive them, but feel I deserve no forgiveness" },
        ],
      },
      {
        id: 's4',
        text: 'How do you feel about your worth to the people around you?',
        options: [
          { value: 0, label: 'I matter to them' },
          { value: 1, label: 'Sometimes unsure' },
          { value: 2, label: "I feel I'm more of a burden than a help" },
          { value: 3, label: "They'd be better off without me" },
        ],
      },
    ],
  },
  {
    key: 'connection',
    title: 'The world and others',
    intro: 'How you relate to and interpret other people.',
    weight: 0.9,
    items: [
      {
        id: 'c1',
        text: "When someone doesn't reply or seems distant, what does your mind conclude?",
        options: [
          { value: 0, label: "They're probably busy" },
          { value: 1, label: 'I wonder a little, then let it go' },
          { value: 2, label: 'I assume I did something wrong' },
          { value: 3, label: "I'm sure they dislike or have abandoned me" },
        ],
      },
      {
        id: 'c2',
        text: 'How do you see people around you?',
        options: [
          { value: 0, label: 'Mostly kind and supportive' },
          { value: 1, label: 'A mix of good and bad' },
          { value: 2, label: 'Mostly distant or uncaring' },
          { value: 3, label: 'Hostile or not worth the effort' },
        ],
      },
    ],
  },
  {
    key: 'anxiety',
    title: 'The future',
    intro: 'How you feel when you think about what lies ahead.',
    weight: 1.1,
    items: [
      {
        id: 'a1',
        text: 'Imagine yourself six months from now. What comes to mind?',
        options: [
          { value: 0, label: 'Something to look forward to' },
          { value: 1, label: "Unclear, but I'm not afraid of it" },
          { value: 2, label: 'More of the same, with little to look forward to' },
          { value: 3, label: 'Nothing, a blank wall' },
        ],
      },
      {
        id: 'a2',
        text: 'Your problems feel like:',
        options: [
          { value: 0, label: 'A hill I can climb' },
          { value: 1, label: 'A tough climb that I can manage' },
          { value: 2, label: "A mountain I can't see the top of" },
          { value: 3, label: 'A pit with no way out' },
        ],
      },
    ],
  },
  {
    key: 'overthinking',
    title: 'Thought patterns',
    intro: 'How your mind processes difficulties and explains events.',
    weight: 1.1,
    items: [
      {
        id: 'o1',
        text: 'How often do the same thoughts loop in your mind without a solution?',
        options: [
          { value: 0, label: 'Rarely' },
          { value: 1, label: 'Sometimes, at night' },
          { value: 2, label: "Often, it's hard to switch off" },
          { value: 3, label: 'Almost constantly' },
        ],
      },
      {
        id: 'o2',
        text: 'When something goes wrong, how do you explain it?',
        options: [
          { value: 0, label: 'A one-time situation' },
          { value: 1, label: 'Partly my fault, partly circumstances' },
          { value: 2, label: 'It happens because of something wrong with me' },
          { value: 3, label: 'It always happens, and it will never change' },
        ],
      },
      {
        id: 'o3',
        text: 'How do you describe your days to yourself?',
        options: [
          { value: 0, label: 'Varied, with ups and downs' },
          { value: 1, label: 'Routine, but acceptable' },
          { value: 2, label: 'Repetitive and pointless' },
          { value: 3, label: 'Something I just have to get through' },
        ],
      },
    ],
  },
  {
    key: 'focus',
    title: 'Inner experience',
    intro: 'Your emotional state, energy and sense of connection.',
    weight: 1.0,
    items: [
      {
        id: 'f1',
        text: 'How do you feel emotionally right now?',
        options: [
          { value: 0, label: 'I can feel a normal range of emotions' },
          { value: 1, label: 'A little low or restless' },
          { value: 2, label: 'Numb, or sad without knowing why' },
          { value: 3, label: 'Empty, or overwhelmed by sadness' },
        ],
      },
      {
        id: 'f2',
        text: 'If you could describe your energy and drive as a vehicle, it would be:',
        options: [
          { value: 0, label: 'Running smoothly' },
          { value: 1, label: 'Needs a refill sometimes' },
          { value: 2, label: 'Running on fumes' },
          { value: 3, label: 'Broken down' },
        ],
      },
      {
        id: 'f3',
        text: "When you're alone with your thoughts, how do you feel?",
        options: [
          { value: 0, label: 'Peaceful or comfortable' },
          { value: 1, label: 'Sometimes restless' },
          { value: 2, label: 'Uneasy, I try to avoid it' },
          { value: 3, label: 'Overwhelmed by dark thoughts' },
        ],
      },
      {
        id: 'f4',
        text: 'When you imagine asking someone for help, what do you think?',
        options: [
          { value: 0, label: "They'd be glad to help" },
          { value: 1, label: "I'd feel awkward but would ask" },
          { value: 2, label: "I'd be a bother, so I probably won't" },
          { value: 3, label: "No one could help, so there's no point" },
        ],
      },
    ],
  },
];

// Safety item: never scored into the index — it only drives the crisis-support pathway.
export const SAFETY_ITEM = {
  id: 'x1',
  text: "Have you had thoughts that life isn't worth living, or of hurting yourself?",
  options: [
    { value: 0, label: 'Never' },
    { value: 1, label: 'A fleeting thought once or twice' },
    { value: 2, label: 'Several times' },
    { value: 3, label: "Often, or I've thought about how" },
  ],
};

export const CRISIS_RESOURCES = [
  { name: 'Tele-MANAS (Govt. of India, 24×7, free)', phone: '14416', alt: '1-800-891-4416' },
  { name: 'Emergency services', phone: '112' },
];

export const ALL_ITEM_IDS = [...SECTIONS.flatMap((s) => s.items.map((i) => i.id)), SAFETY_ITEM.id];
