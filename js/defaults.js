// Programação e listas padrão. Tudo aqui é editável pelo usuário depois.
import { todayISO, uid } from './util.js';

const ex = (name, sets, repMin, repMax, unit) => ({ id: uid(), name, sets, repMin, repMax, ...(unit ? { unit } : {}) });

// Semana padrão: 5 dias de musculação, corrida extra em 2 dias (terça e quinta, dias de membros superiores).
// Cada dia tem um treino principal (type/ref) e, opcionalmente, uma corrida no mesmo dia (run).
export const defaultDays = () => [
  { type: 'strength', ref: 'A' },
  { type: 'strength', ref: 'B', run: 'B' },
  { type: 'strength', ref: 'C' },
  { type: 'strength', ref: 'D', run: 'A' },
  { type: 'strength', ref: 'E' },
  { type: 'rest' },
  { type: 'rest' },
];

export const defaultStrength = () => ({
  A: {
    name: 'Treino A', groups: 'Peito • Tríceps',
    exercises: [
      ex('Supino reto com barra', 4, 8, 12),
      ex('Supino inclinado com halteres', 3, 8, 12),
      ex('Crucifixo na máquina', 3, 10, 15),
      ex('Crossover na polia', 3, 12, 15),
      ex('Tríceps na polia (corda)', 3, 10, 15),
      ex('Tríceps francês', 3, 10, 12),
      ex('Tríceps testa', 3, 10, 12),
    ],
  },
  B: {
    name: 'Treino B', groups: 'Costas • Bíceps',
    exercises: [
      ex('Puxada frontal', 4, 8, 12),
      ex('Remada curvada com barra', 3, 8, 12),
      ex('Remada baixa', 3, 10, 12),
      ex('Remada unilateral com halter', 3, 10, 12),
      ex('Rosca direta', 3, 8, 12),
      ex('Rosca martelo', 3, 10, 12),
      ex('Rosca Scott', 3, 10, 12),
    ],
  },
  C: {
    name: 'Treino C', groups: 'Quadríceps • Panturrilhas',
    exercises: [
      ex('Agachamento livre', 4, 8, 12),
      ex('Leg press 45°', 4, 10, 12),
      ex('Cadeira extensora', 3, 12, 15),
      ex('Afundo', 3, 10, 12),
      ex('Panturrilha em pé', 4, 12, 20),
      ex('Panturrilha sentado', 3, 15, 20),
    ],
  },
  D: {
    name: 'Treino D', groups: 'Ombros • Trapézio • Abdômen',
    exercises: [
      ex('Desenvolvimento com halteres', 4, 8, 12),
      ex('Elevação lateral', 4, 12, 15),
      ex('Elevação frontal', 3, 10, 12),
      ex('Crucifixo inverso', 3, 12, 15),
      ex('Encolhimento com halteres', 4, 12, 15),
      ex('Abdominal na polia', 3, 12, 15),
      ex('Prancha', 3, 30, 60, 's'),
    ],
  },
  E: {
    name: 'Treino E', groups: 'Posterior • Glúteos • Abdômen',
    exercises: [
      ex('Stiff', 4, 8, 12),
      ex('Mesa flexora', 3, 10, 15),
      ex('Cadeira flexora', 3, 10, 15),
      ex('Elevação pélvica', 4, 10, 12),
      ex('Abdução de quadril na máquina', 3, 15, 20),
      ex('Glúteo na polia (coice)', 3, 12, 15),
      ex('Elevação de pernas', 3, 12, 15),
    ],
  },
});

export const RUN_NAMES = {
  A: { name: 'Corrida A – Resistência', short: 'Resistência', goals: 'Resistência, tempo e distância' },
  B: { name: 'Corrida B – Velocidade', short: 'Velocidade', goals: 'Velocidade, ritmo e tiros' },
};
export const REST_NAME = { name: 'Recuperação', sub: 'Descanso, caminhada leve ou mobilidade' };

export const defaultTemplates = () => ({
  strength: defaultStrength(),
  run: {
    A: { ...RUN_NAMES.A, targetMin: 25, targetKm: 3 },
    B: { ...RUN_NAMES.B, warmupMin: 10, intervals: 6, workSec: 60, recSec: 90, cooldownMin: 5, targetPaceSec: null },
  },
});

// Frases da Grécia Antiga exibidas na tela inicial
export const GREEK_QUOTES = [
  ['Conhece-te a ti mesmo.', 'Templo de Apolo em Delfos'],
  ['Nada em excesso.', 'Templo de Apolo em Delfos'],
  ['Somos o que fazemos repetidamente.', 'Inspirado em Aristóteles'],
  ['Ninguém se banha duas vezes no mesmo rio.', 'Heráclito'],
  ['A disciplina é a mãe da vitória.', 'Provérbio espartano'],
  ['Volte com o escudo ou sobre ele.', 'Mães espartanas'],
  ['O começo é a metade do todo.', 'Pitágoras'],
];

export const defaultProfile = () => ({
  name: '', sex: '', birthYear: '', heightCm: '', weightKg: '',
  experience: 'iniciante', goal: 'condicionamento', startDate: todayISO(),
});

export const GOALS = [
  ['emagrecimento', 'Emagrecimento'],
  ['hipertrofia', 'Hipertrofia'],
  ['condicionamento', 'Condicionamento físico'],
  ['corrida', 'Melhoria da corrida'],
  ['recomposicao', 'Recomposição corporal'],
];
export const LEVELS = [['iniciante', 'Iniciante'], ['intermediario', 'Intermediário'], ['avancado', 'Avançado']];
export const MODALITIES = [['rua', 'Rua'], ['esteira', 'Esteira'], ['pista', 'Pista'], ['parque', 'Parque']];
export const MEASURES = [
  ['peito', 'Peito'], ['cintura', 'Cintura'], ['abdomen', 'Abdômen'], ['quadril', 'Quadril'],
  ['bracoD', 'Braço dir.'], ['bracoE', 'Braço esq.'], ['coxaD', 'Coxa dir.'], ['coxaE', 'Coxa esq.'],
  ['panturrilha', 'Panturrilha'],
];
export const REST_ACTIVITIES = [
  ['descanso', 'Descanso total'], ['caminhada', 'Caminhada leve'], ['mobilidade', 'Mobilidade'],
  ['alongamento', 'Alongamento'], ['outra', 'Outra atividade'],
];
export const PAIN_AREAS = [
  ['joelho', 'Joelho'], ['tornozelo', 'Tornozelo/pé'], ['canela', 'Canela'], ['quadril', 'Quadril'],
  ['lombar', 'Lombar'], ['ombro', 'Ombro'], ['cotovelo', 'Cotovelo/punho'], ['outra', 'Outra'],
];
export const POSES = [['frente', 'Frente'], ['lado', 'Lado'], ['costas', 'Costas']];
