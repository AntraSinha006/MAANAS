import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { db, migrate, transaction } from './db.js';

// All people below are fictional demo content.
export const DEMO_ACCOUNTS = {
  user: { email: 'demo@maanas.app', password: 'demo1234' },
  therapist: { email: 'aanya@maanas.app', password: 'therapist123' },
  admin: { email: 'admin@maanas.app', password: 'admin1234' },
};

const THERAPISTS = [
  {
    name: 'Dr. Aanya Sharma', email: 'aanya@maanas.app', title: 'Clinical Psychologist',
    specialities: ['anxiety', 'overthinking'], languages: ['English', 'Hindi'], experience: 8,
    qualifications: 'M.Phil Clinical Psychology (demo)', fee: 800,
    about: 'A supportive, practical space for managing everyday stress, anxious thoughts, and racing “what-ifs”.',
    approach: 'CBT-informed: noticing thought loops, grounding, and small manageable next steps.',
    days: [1, 2, 3, 4, 5], times: ['10:00', '11:30', '15:00', '17:00'],
  },
  {
    name: 'Rohan Mehta', email: 'rohan@maanas.app', title: 'Counselling Psychologist',
    specialities: ['focus', 'anxiety'], languages: ['English', 'Hindi'], experience: 6,
    qualifications: 'M.A. Counselling Psychology (demo)', fee: 600,
    about: 'A student-focused space for academic pressure, exam stress, motivation, and finding balance.',
    approach: 'Goal setting, routine building, and compassionate weekly check-ins.',
    days: [1, 3, 5, 6], times: ['09:30', '12:00', '16:30', '19:00'],
  },
  {
    name: 'Mira Sen', email: 'mira@maanas.app', title: 'Psychotherapist',
    specialities: ['mood', 'connection'], languages: ['English', 'Bengali'], experience: 7,
    qualifications: 'M.Sc Psychology, Diploma in Psychotherapy (demo)', fee: 900,
    about: 'A calm place to explore low mood, relationships, self-understanding and personal change.',
    approach: 'Reflective conversation and gentle emotional-awareness exercises.',
    days: [2, 3, 4, 6], times: ['11:00', '14:00', '18:00'],
  },
  {
    name: 'Kabir Das', email: 'kabir@maanas.app', title: 'Counsellor',
    specialities: ['sleep', 'mood'], languages: ['English', 'Hindi', 'Bengali'], experience: 5,
    qualifications: 'M.A. Psychology (demo)', fee: 500,
    about: 'Support for building steadier routines, winding down at night, and more restorative habits.',
    approach: 'Sleep-habit exploration, wind-down planning and realistic routines.',
    days: [1, 2, 4, 5, 6], times: ['08:30', '13:00', '20:00'],
  },
  {
    name: 'Dr. Priya Iyer', email: 'priya@maanas.app', title: 'Psychiatric Social Worker',
    specialities: ['overthinking', 'mood', 'anxiety'], languages: ['English', 'Tamil'], experience: 11,
    qualifications: 'M.Phil Psychiatric Social Work (demo)', fee: 1000,
    about: 'Helping people untangle overthinking, rumination and self-criticism with warmth and structure.',
    approach: 'Mindfulness-based and acceptance-focused techniques.',
    days: [1, 2, 3, 4, 5], times: ['10:30', '12:30', '16:00'],
  },
  {
    name: 'Arjun Kulkarni', email: 'arjun@maanas.app', title: 'Counselling Psychologist',
    specialities: ['connection', 'focus'], languages: ['English', 'Marathi', 'Hindi'], experience: 4,
    qualifications: 'M.A. Applied Psychology (demo)', fee: 450,
    about: 'A friendly space for loneliness, moving to a new city, friendships and work-life balance.',
    approach: 'Solution-focused conversations and social-confidence building.',
    days: [0, 2, 4, 6], times: ['10:00', '15:30', '18:30'],
  },
];

const PENDING_THERAPIST = {
  name: 'Neha Verma', email: 'neha@maanas.app', title: 'Counsellor (applicant)',
  specialities: ['anxiety'], languages: ['English', 'Hindi'], experience: 2,
  qualifications: 'M.A. Psychology (demo)', fee: 400,
  about: 'Recently qualified counsellor applying to join MAANAS — waiting for admin review.',
  approach: 'Person-centred listening.', days: [1, 2, 3], times: ['17:00', '18:30'],
};

export function seed() {
  const hash = (pw) => bcrypt.hashSync(pw, 10);
  transaction(() => {
    const insertUser = db.prepare(`INSERT INTO users (name, email, password_hash, role, age_group, language, email_verified) VALUES (?,?,?,?,?,?,1)`);
    insertUser.run('MAANAS Admin', DEMO_ACCOUNTS.admin.email, hash(DEMO_ACCOUNTS.admin.password), 'admin', null, 'English');
    const demo = insertUser.run('Riya (demo)', DEMO_ACCOUNTS.user.email, hash(DEMO_ACCOUNTS.user.password), 'user', '18–24', 'Hindi');

    const therapistHash = hash('therapist123');
    const insertTherapist = db.prepare(`
      INSERT INTO therapists (user_id, title, specialities, languages, experience_years, qualifications, about, approach,
        fee_inr, working_days, slot_times, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const [list, status] of [[THERAPISTS, 'approved'], [[PENDING_THERAPIST], 'pending']]) {
      for (const t of list) {
        const u = db.prepare(`INSERT INTO users (name, email, password_hash, role, language, email_verified) VALUES (?,?,?,?,?,1)`)
          .run(t.name, t.email, therapistHash, 'therapist', t.languages[0]);
        insertTherapist.run(u.lastInsertRowid, t.title, JSON.stringify(t.specialities), JSON.stringify(t.languages), t.experience,
          t.qualifications, t.about, t.approach, t.fee, JSON.stringify(t.days), JSON.stringify(t.times), status);
      }
    }

    // A few past check-ins so the demo mood tracker isn't empty.
    const moods = ['okay', 'anxious', 'tired', 'okay', 'great'];
    const insertCheckin = db.prepare('INSERT INTO checkins (user_id, mood, answers, note, created_at) VALUES (?,?,?,?,?)');
    moods.forEach((mood, i) => {
      const at = new Date(Date.now() - (moods.length - i) * 24 * 60 * 60 * 1000).toISOString();
      insertCheckin.run(demo.lastInsertRowid, mood, '{}', i === 1 ? 'Exam week — kept replaying the viva in my head.' : null, at);
    });
  });
}

export function seedIfEmpty() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (Number(n) === 0) {
    seed();
    console.log('Seeded demo data (admin, demo user, 7 therapists).');
  }
}

// `npm run seed` → wipe and re-create the database.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--reset')) {
    db.close();
    for (const suffix of ['', '-wal', '-shm']) fs.rmSync(config.dbFile + suffix, { force: true });
    console.log(`Deleted ${config.dbFile}. Fresh demo data will be created on the next "npm start".`);
  } else {
    migrate();
    seedIfEmpty();
  }
}
