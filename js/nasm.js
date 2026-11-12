// NASM Ambush: random pop-quiz encounters during the IT shift.
// Encounter times and questions come from a seeded random, so every device sees the same ones.
import { AMBUSHES_PER_SHIFT } from './rpgMath.js';

// NASM CPT practice questions. `a` is the index of the correct option.
export const QUESTIONS = [
  { id: 'opt-phases', q: 'How many phases are in the NASM OPT model?', o: ['3', '4', '5', '6'], a: 2, why: 'Stabilization Endurance, Strength Endurance, Muscular Development, Maximal Strength and Power.' },
  { id: 'opt-p1', q: 'Phase 1 of the OPT model is:', o: ['Strength Endurance', 'Stabilization Endurance', 'Power', 'Muscular Development'], a: 1, why: 'Phase 1 is Stabilization Endurance training.' },
  { id: 'opt-p2', q: 'Phase 2 of the OPT model is:', o: ['Strength Endurance', 'Maximal Strength', 'Stabilization Endurance', 'Power'], a: 0, why: 'Phase 2 is Strength Endurance, the first phase of the Strength level.' },
  { id: 'opt-p3', q: 'Which OPT phase focuses on hypertrophy?', o: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 5'], a: 2, why: 'Phase 3, Muscular Development, targets maximal muscle growth.' },
  { id: 'opt-p4', q: 'Phase 4 of the OPT model is:', o: ['Power', 'Maximal Strength', 'Muscular Development', 'Strength Endurance'], a: 1, why: 'Phase 4 is Maximal Strength training.' },
  { id: 'opt-p5', q: 'Phase 5 of the OPT model is:', o: ['Power', 'Stabilization Endurance', 'Maximal Strength', 'Muscular Development'], a: 0, why: 'Phase 5 is Power, the only phase in the Power level.' },
  { id: 'p1-tempo', q: 'What resistance training tempo is used in Phase 1?', o: ['1/1/1', 'X/X/X', '2/0/2', '4/2/1'], a: 3, why: 'Slow 4/2/1: 4 s eccentric, 2 s isometric, 1 s concentric.' },
  { id: 'p1-reps', q: 'What rep range is used in Phase 1 (Stabilization Endurance)?', o: ['1–5', '6–12', '8–12', '12–20'], a: 3, why: 'Stabilization Endurance uses high reps: 12–20.' },
  { id: 'p1-rest', q: 'What rest interval is used in Phase 1?', o: ['0–90 seconds', '2–3 minutes', '3–5 minutes', '5–7 minutes'], a: 0, why: 'Phase 1 rests 0–90 seconds between sets.' },
  { id: 'p2-method', q: 'Phase 2 (Strength Endurance) is built around:', o: ['Complex training with plyometrics', 'Supersets of a strength exercise followed by a stabilization exercise', 'Single sets to failure', 'Olympic lifts only'], a: 1, why: 'A strength exercise is immediately followed by a similar stabilization exercise.' },
  { id: 'p3-reps', q: 'What rep range is used in Phase 3 (Muscular Development)?', o: ['1–5', '6–12', '12–20', '20–25'], a: 1, why: 'Hypertrophy training uses 6–12 reps at 75–85% of 1RM.' },
  { id: 'p4-load', q: 'What intensity is used in Phase 4 (Maximal Strength)?', o: ['50–70% of 1RM', '70–80% of 1RM', '85–100% of 1RM', '30–45% of 1RM'], a: 2, why: 'Maximal Strength uses heavy loads: 85–100% of 1RM for 1–5 reps.' },
  { id: 'p4-rest', q: 'What rest interval is used in Phase 4 (Maximal Strength)?', o: ['0–60 seconds', '60–90 seconds', '1–2 minutes', '3–5 minutes'], a: 3, why: 'Heavy loads need 3–5 minutes to recover.' },
  { id: 'p5-load', q: 'In Phase 5, the power exercise in each superset is performed at:', o: ['85–100% of 1RM', '30–45% of 1RM (or up to ~10% of body weight)', '65–75% of 1RM', '5% of 1RM'], a: 1, why: 'Power exercises are light and fast: 30–45% of 1RM, or about 10% of body weight for medicine balls.' },
  { id: 'lcs', q: 'Lower crossed syndrome typically shows overactive:', o: ['Gluteus maximus and abdominals', 'Hip flexors and erector spinae', 'Hamstrings and anterior tibialis', 'Rhomboids and lower trapezius'], a: 1, why: 'Tight hip flexors and erector spinae, with weak glutes and abs, tilt the pelvis anteriorly.' },
  { id: 'ucs', q: 'Upper crossed syndrome is characterized by:', o: ['Flat feet and knee valgus', 'Forward head and rounded shoulders', 'Excessive low-back arch', 'Feet turning out'], a: 1, why: 'Tight pecs and upper traps with weak deep neck flexors and mid/lower traps.' },
  { id: 'pds', q: 'Pronation distortion syndrome is characterized by:', o: ['Forward head', 'Rounded shoulders', 'Flat feet and knees moving inward', 'An arched low back'], a: 2, why: 'Excessive foot pronation with knee adduction and internal rotation.' },
  { id: 'ohsa-valgus', q: 'In the overhead squat assessment, knees caving inward suggest which muscle is likely overactive?', o: ['Gluteus medius', 'Adductor complex', 'Anterior tibialis', 'Rectus abdominis'], a: 1, why: 'Overactive adductors (and TFL) with underactive glute medius/maximus.' },
  { id: 'ohsa-lean', q: 'Excessive forward lean in the overhead squat suggests which muscle is likely overactive?', o: ['Gluteus maximus', 'Erector spinae', 'Hip flexor complex', 'Anterior tibialis'], a: 2, why: 'Overactive hip flexors, soleus and gastrocnemius; underactive glute max, erector spinae and anterior tibialis.' },
  { id: 'ohsa-arms', q: 'Arms falling forward in the overhead squat suggests which muscle is likely overactive?', o: ['Latissimus dorsi', 'Lower trapezius', 'Rhomboids', 'Rotator cuff'], a: 0, why: 'Overactive lats, teres major and pecs; underactive mid/lower traps, rhomboids and rotator cuff.' },
  { id: 'ohsa-arch', q: 'A low back that arches in the overhead squat suggests which muscle is likely underactive?', o: ['Erector spinae', 'Hip flexor complex', 'Latissimus dorsi', 'Gluteus maximus'], a: 3, why: 'Underactive glute max, hamstrings and intrinsic core; overactive hip flexors, erector spinae and lats.' },
  { id: 'ohsa-feet', q: 'Feet turning out in the overhead squat suggests which muscle is likely overactive?', o: ['Soleus', 'Medial gastrocnemius', 'Gracilis', 'Popliteus'], a: 0, why: 'Overactive soleus, lateral gastrocnemius and short head of the biceps femoris.' },
  { id: 'recip-inhib', q: 'Reciprocal inhibition is:', o: ['A tight muscle reducing drive to its antagonist', 'The agonist contracting while the antagonist relaxes', 'Tension causing the same muscle to relax', 'Synergists taking over for a weak prime mover'], a: 1, why: 'Contracting the agonist causes its functional antagonist to relax, allowing movement.' },
  { id: 'altered-ri', q: 'Altered reciprocal inhibition is:', o: ['A tight agonist reducing neural drive to its functional antagonist', 'Normal relaxation of the antagonist', 'A joint losing its normal motion', 'Tension sensed by the Golgi tendon organ'], a: 0, why: 'A tight (overactive) muscle decreases neural drive to its opposing muscle.' },
  { id: 'synergistic', q: 'Synergistic dominance occurs when:', o: ['The prime mover overpowers its synergists', 'Synergists take over for a weak or inhibited prime mover', 'Two muscles contract at the same time', 'A muscle lengthens under tension'], a: 1, why: 'Example: hamstrings doing the glute max’s job in hip extension.' },
  { id: 'gto', q: 'Autogenic inhibition is driven by which receptor?', o: ['Muscle spindle', 'Golgi tendon organ', 'Pacinian corpuscle', 'Baroreceptor'], a: 1, why: 'The GTO senses sustained tension and relaxes the muscle, the basis for SMR and static stretching.' },
  { id: 'spindle', q: 'Muscle spindles mainly sense:', o: ['Changes in muscle length and its rate of change', 'Blood pressure', 'Changes in tension', 'Joint angle only'], a: 0, why: 'Spindles detect stretch and trigger the stretch reflex.' },
  { id: 'gto-sense', q: 'Golgi tendon organs mainly sense:', o: ['Muscle length', 'Changes in muscular tension', 'Heart rate', 'Joint pressure only'], a: 1, why: 'GTOs sit at the muscle-tendon junction and sense tension.' },
  { id: 'kinetic-chain', q: 'The human movement system (kinetic chain) is made up of the:', o: ['Nervous, skeletal and muscular systems', 'Cardiovascular and respiratory systems', 'Digestive and endocrine systems', 'Muscular and endocrine systems'], a: 0, why: 'Nervous, skeletal and muscular systems working together.' },
  { id: 'plane-curl', q: 'A biceps curl happens mainly in which plane of motion?', o: ['Frontal', 'Sagittal', 'Transverse', 'Oblique'], a: 1, why: 'Flexion and extension happen in the sagittal plane.' },
  { id: 'plane-raise', q: 'A side lateral raise happens mainly in which plane of motion?', o: ['Sagittal', 'Transverse', 'Frontal', 'Coronal-transverse'], a: 2, why: 'Abduction and adduction happen in the frontal plane.' },
  { id: 'plane-rotation', q: 'Trunk rotation happens mainly in which plane of motion?', o: ['Transverse', 'Frontal', 'Sagittal', 'None'], a: 0, why: 'Rotation happens in the transverse plane.' },
  { id: 'eccentric', q: 'An eccentric muscle action is when the muscle:', o: ['Shortens under tension', 'Stays the same length', 'Lengthens under tension to decelerate', 'Relaxes completely'], a: 2, why: 'Eccentric = lengthening under tension, like lowering into a squat.' },
  { id: 'isometric', q: 'An isometric muscle action is when:', o: ['The muscle shortens', 'The muscle lengthens', 'Force is produced with no visible change in muscle length', 'The joint moves through full range'], a: 2, why: 'Isometric actions stabilize, like holding a plank.' },
  { id: 'fat-kcal', q: 'How many calories are in 1 gram of fat?', o: ['4', '7', '9', '12'], a: 2, why: 'Fat has 9 kcal/g; protein and carbs have 4; alcohol has 7.' },
  { id: 'protein-kcal', q: 'How many calories are in 1 gram of protein?', o: ['4', '7', '9', '2'], a: 0, why: 'Protein and carbohydrate both have 4 kcal/g.' },
  { id: 'alcohol-kcal', q: 'How many calories are in 1 gram of alcohol?', o: ['4', '7', '9', '0'], a: 1, why: 'Alcohol has 7 kcal/g.' },
  { id: 'hrmax', q: 'The traditional estimate of maximal heart rate is:', o: ['200 − age', '220 − age', '208 − age', '180 − age'], a: 1, why: 'HRmax ≈ 220 − age (NASM also cites Tanaka: 208 − 0.7 × age).' },
  { id: 'atp-pc', q: 'Which energy system mainly fuels all-out efforts of about 10 seconds or less?', o: ['Oxidative (aerobic)', 'Glycolysis', 'ATP-PC (phosphagen)', 'Beta-oxidation'], a: 2, why: 'The ATP-PC system supplies immediate energy for very short, intense efforts.' },
  { id: 'static-hold', q: 'NASM’s general recommendation for holding a static stretch is:', o: ['5 seconds', '10 seconds', '30 seconds', '3 minutes'], a: 2, why: 'Hold static stretches for about 30 seconds.' },
  { id: 'flex-active', q: 'Active flexibility combines SMR with which type of stretching?', o: ['Static', 'Active-isolated', 'Dynamic', 'Ballistic'], a: 1, why: 'Corrective = SMR + static; active = SMR + active-isolated; functional = SMR + dynamic.' },
  { id: 'flex-functional', q: 'Functional flexibility combines SMR with which type of stretching?', o: ['Static', 'Active-isolated', 'Dynamic', 'PNF only'], a: 2, why: 'Functional flexibility uses SMR plus dynamic stretching.' },
  { id: 'parq', q: 'The PAR-Q is mainly used to:', o: ['Measure body fat', 'Screen for health risks before starting exercise', 'Test cardiorespiratory fitness', 'Assess posture'], a: 1, why: 'It identifies people who may need medical clearance before exercising.' },
  { id: 'bmi', q: 'Body mass index (BMI) is calculated as:', o: ['Height ÷ weight', 'Weight (kg) ÷ height (m)²', 'Waist ÷ hip', 'Weight (lb) × height (in)'], a: 1, why: 'BMI = weight in kilograms divided by height in meters squared.' },
  { id: 'davies', q: 'The Davies test assesses:', o: ['Lower-body power', 'Upper-extremity agility and stabilization', 'Aerobic capacity', 'Hamstring flexibility'], a: 1, why: 'The client alternates touching hands while in a push-up position.' },
  { id: 'shark', q: 'The shark skill test assesses:', o: ['Upper-body endurance', 'Lower-extremity agility and neuromuscular control', 'Grip strength', 'Core endurance'], a: 1, why: 'Single-leg hops around a grid, testing agility and control.' },
  { id: 'drawing-in', q: 'The drawing-in maneuver mainly activates:', o: ['Rectus abdominis', 'Transverse abdominis', 'Latissimus dorsi', 'Erector spinae'], a: 1, why: 'Pulling the navel in toward the spine recruits the local stabilizers, mainly the transverse abdominis.' },
  { id: 'local-stab', q: 'Which muscle is part of the local stabilization system?', o: ['Latissimus dorsi', 'Rectus abdominis', 'Transverse abdominis', 'Hamstrings'], a: 2, why: 'Local stabilizers include the transverse abdominis, multifidus, internal oblique, diaphragm and pelvic floor.' },
  { id: 'stage1', q: 'Stage 1 cardiorespiratory training is performed in which heart-rate zone?', o: ['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4'], a: 0, why: 'Stage 1 builds an aerobic base in zone 1 (about 65–75% of HRmax).' },
  { id: 'type1', q: 'Type I muscle fibers are:', o: ['Fast-twitch and quick to fatigue', 'Slow-twitch and fatigue resistant', 'Only found in the arms', 'Larger than type II fibers'], a: 1, why: 'Type I fibers are slow-twitch, smaller and built for endurance.' },
  { id: 'said', q: 'The SAID principle stands for:', o: ['Strength And Intensity Development', 'Specific Adaptation to Imposed Demands', 'Speed, Agility, Intensity, Duration', 'Stabilization And Integrated Design'], a: 1, why: 'The body adapts specifically to the demands you place on it.' },
  { id: 'gas', q: 'The stages of the General Adaptation Syndrome are:', o: ['Alarm reaction, resistance development, exhaustion', 'Warm-up, workout, cool-down', 'Stabilization, strength, power', 'Concentric, isometric, eccentric'], a: 0, why: 'Alarm reaction → resistance development → exhaustion.' },
  { id: 'pushup-test', q: 'The push-up test mainly measures:', o: ['Upper-body muscular endurance', 'Maximal strength', 'Lower-body power', 'Flexibility'], a: 0, why: 'Clients do as many push-ups as possible in 60 seconds.' },
];

// Small seeded random generator (FNV-1a hash into xorshift).
function seeded(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
}

// The encounters for one IT shift: one random time in each equal slice of the shift,
// kept at least 15 minutes from either end.
export function encountersFor(itQuest) {
  const rand = seeded('ambush-' + itQuest.date);
  const margin = 15 * 60000;
  const slice = (itQuest.end - itQuest.start - 2 * margin) / AMBUSHES_PER_SHIFT;
  return Array.from({ length: AMBUSHES_PER_SHIFT }, (_, i) => ({
    id: `ambush-${itQuest.date}-${i}`,
    date: itQuest.date,
    at: Math.round(itQuest.start + margin + slice * (i + rand())),
  }));
}

// Pick a question for an encounter, preferring ones you haven't answered correctly yet.
export function questionFor(encounterId, ambushes) {
  const solved = new Set(ambushes.filter(a => a.correct).map(a => a.questionId));
  const pool = QUESTIONS.filter(q => !solved.has(q.id));
  const list = pool.length ? pool : QUESTIONS;
  const rand = seeded(encounterId);
  const question = list[Math.floor(rand() * list.length)];
  const order = question.o.map((_, i) => i).sort(() => rand() - 0.5);
  return { question, order };
}
