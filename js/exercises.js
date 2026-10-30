// Biblioteca de exercícios. Campos: nome, grupo principal, músculos secundários, equipamento,
// nível (1 iniciante, 2 intermediário, 3 avançado), execução, postura, erros comuns.
import { S } from './store.js';

export const GROUPS = ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Antebraço', 'Trapézio', 'Abdômen', 'Quadríceps', 'Posterior de coxa', 'Glúteos', 'Panturrilhas', 'Funcional'];
export const EQUIPMENT = ['Barra', 'Halteres', 'Máquina', 'Polia', 'Peso corporal', 'Kettlebell', 'Funcional'];
export const LEVEL_NAME = { 1: 'Iniciante', 2: 'Intermediário', 3: 'Avançado' };

const RAW = [
  // Peito
  ['Supino reto com barra', 'Peito', 'Tríceps, deltoide anterior', 'Barra', 2, 'Deitado no banco, desça a barra controlando até tocar levemente o meio do peito e empurre até estender os cotovelos.', 'Escápulas retraídas, pés firmes no chão, leve arco natural na lombar.', 'Quicar a barra no peito; abrir demais os cotovelos (90°); tirar o quadril do banco.'],
  ['Supino inclinado com barra', 'Peito', 'Deltoide anterior, tríceps', 'Barra', 2, 'Banco a 30–45°, desça a barra até a parte alta do peito e empurre.', 'Escápulas encaixadas e cotovelos a cerca de 60° do tronco.', 'Inclinação excessiva (vira exercício de ombro); amplitude curta.'],
  ['Supino inclinado com halteres', 'Peito', 'Deltoide anterior, tríceps', 'Halteres', 1, 'Banco a 30–45°, desça os halteres ao lado do peito e empurre unindo-os acima.', 'Punhos alinhados aos cotovelos, escápulas apoiadas.', 'Bater os halteres no topo; descer rápido sem controle.'],
  ['Supino reto com halteres', 'Peito', 'Tríceps, deltoide anterior', 'Halteres', 1, 'Deitado, desça os halteres até a linha do peito e empurre para cima.', 'Pés no chão e ombros longe das orelhas.', 'Amplitude curta; perder a estabilidade dos punhos.'],
  ['Supino declinado', 'Peito', 'Tríceps', 'Barra', 2, 'Banco declinado, desça a barra até a parte baixa do peito e empurre.', 'Pernas travadas no apoio, escápulas retraídas.', 'Descer a barra no pescoço; tirar o quadril do banco.'],
  ['Crucifixo com halteres', 'Peito', 'Deltoide anterior', 'Halteres', 1, 'Braços levemente flexionados, abra até sentir alongar o peito e feche em arco.', 'Cotovelos fixos na mesma flexão durante todo o movimento.', 'Transformar em supino flexionando o cotovelo; descer além do confortável.'],
  ['Crucifixo na máquina', 'Peito', 'Deltoide anterior', 'Máquina', 1, 'Sentado, una as alças à frente do peito e retorne controlando.', 'Costas apoiadas, peito aberto.', 'Deixar o peso bater no retorno; projetar os ombros à frente.'],
  ['Crossover na polia', 'Peito', 'Deltoide anterior', 'Polia', 2, 'Em pé entre as polias, traga as alças para a frente e para baixo, cruzando levemente.', 'Tronco levemente inclinado, abdômen firme.', 'Usar o corpo para puxar; flexionar demais os cotovelos.'],
  ['Flexão de braço', 'Peito', 'Tríceps, core', 'Peso corporal', 1, 'Mãos um pouco mais abertas que os ombros, desça o peito até perto do chão e empurre.', 'Corpo alinhado da cabeça aos calcanhares.', 'Quadril caído ou elevado; cabeça projetada à frente.'],
  ['Supino na máquina', 'Peito', 'Tríceps', 'Máquina', 1, 'Empurre as alças à frente até quase estender e retorne controlando.', 'Costas apoiadas e escápulas retraídas.', 'Travar os cotovelos com impacto; elevar os ombros.'],
  // Costas
  ['Puxada frontal', 'Costas', 'Bíceps, romboides', 'Polia', 1, 'Puxe a barra até a parte alta do peito levando os cotovelos para baixo e para trás.', 'Peito aberto, leve inclinação do tronco para trás.', 'Puxar atrás da nuca; balançar o corpo; não estender os braços no retorno.'],
  ['Barra fixa', 'Costas', 'Bíceps, core', 'Peso corporal', 3, 'Pendurado, puxe o corpo até o queixo passar a barra e desça controlando.', 'Escápulas ativas, abdômen contraído.', 'Usar impulso das pernas; meia amplitude.'],
  ['Remada curvada com barra', 'Costas', 'Bíceps, lombar, trapézio', 'Barra', 2, 'Tronco inclinado, puxe a barra em direção ao umbigo e desça controlando.', 'Coluna neutra, joelhos levemente flexionados.', 'Arredondar a lombar; usar o tronco para dar impulso.'],
  ['Remada baixa', 'Costas', 'Bíceps, romboides', 'Polia', 1, 'Sentado, puxe o triângulo até o abdômen aproximando as escápulas.', 'Tronco ereto, peito aberto.', 'Balançar o tronco para frente e para trás; elevar os ombros.'],
  ['Remada unilateral com halter', 'Costas', 'Bíceps, deltoide posterior', 'Halteres', 1, 'Apoiado no banco, puxe o halter ao lado do quadril e desça alongando.', 'Coluna neutra, ombros paralelos ao chão.', 'Girar o tronco; puxar com o braço em vez das costas.'],
  ['Remada cavalinho', 'Costas', 'Bíceps, trapézio', 'Barra', 2, 'Com a barra T, puxe em direção ao peito mantendo o tronco inclinado.', 'Lombar neutra e joelhos semiflexionados.', 'Erguer o tronco a cada repetição; arredondar as costas.'],
  ['Pulldown com corda', 'Costas', 'Tríceps (longa), core', 'Polia', 2, 'Braços quase estendidos, leve a corda da altura da cabeça até as coxas.', 'Tronco levemente inclinado, cotovelos fixos.', 'Flexionar os cotovelos; usar o tronco.'],
  ['Levantamento terra', 'Costas', 'Glúteos, posterior, lombar', 'Barra', 3, 'Com a barra próxima às canelas, estenda quadril e joelhos juntos até ficar em pé.', 'Coluna neutra, barra colada ao corpo, abdômen firme.', 'Arredondar a lombar; afastar a barra do corpo; hiperestender no topo.'],
  ['Hiperextensão lombar', 'Costas', 'Glúteos, posterior', 'Peso corporal', 1, 'No banco romano, desça o tronco e suba até alinhar com as pernas.', 'Movimento controlado, sem passar da linha do corpo.', 'Hiperestender a coluna; balanço rápido.'],
  // Ombros
  ['Desenvolvimento com halteres', 'Ombros', 'Tríceps, trapézio', 'Halteres', 1, 'Sentado, empurre os halteres acima da cabeça e desça até a altura das orelhas.', 'Costas apoiadas, abdômen firme.', 'Arquear a lombar; descer pouco.'],
  ['Desenvolvimento com barra', 'Ombros', 'Tríceps', 'Barra', 2, 'Em pé ou sentado, empurre a barra da clavícula até acima da cabeça.', 'Glúteos e abdômen contraídos, cabeça passa levemente à frente no topo.', 'Inclinar o tronco para trás; usar as pernas.'],
  ['Elevação lateral', 'Ombros', 'Trapézio', 'Halteres', 1, 'Eleve os halteres lateralmente até a linha dos ombros e desça controlando.', 'Cotovelos levemente flexionados, tronco estável.', 'Balançar o corpo; subir acima dos ombros encolhendo o trapézio.'],
  ['Elevação frontal', 'Ombros', 'Peito superior', 'Halteres', 1, 'Eleve os halteres à frente até a altura dos ombros.', 'Tronco firme, sem balanço.', 'Impulsionar com o corpo; subir além da linha dos ombros.'],
  ['Crucifixo inverso', 'Ombros', 'Romboides, trapézio', 'Máquina', 1, 'Na máquina (ou inclinado com halteres), abra os braços para trás.', 'Peito apoiado, cotovelos levemente flexionados.', 'Usar o trapézio encolhendo os ombros; carga excessiva.'],
  ['Face pull', 'Ombros', 'Manguito rotador, trapézio', 'Polia', 2, 'Puxe a corda em direção ao rosto abrindo os cotovelos.', 'Cotovelos na altura dos ombros, peito aberto.', 'Puxar com os braços baixos; inclinar o tronco.'],
  // Bíceps
  ['Rosca direta', 'Bíceps', 'Antebraço', 'Barra', 1, 'Flexione os cotovelos levando a barra até o peito e desça controlando.', 'Cotovelos junto ao corpo, tronco imóvel.', 'Balançar o corpo; mover os cotovelos para frente.'],
  ['Rosca alternada', 'Bíceps', 'Antebraço', 'Halteres', 1, 'Alterne os braços girando o punho (supinação) na subida.', 'Cotovelos fixos ao lado do tronco.', 'Usar impulso; amplitude curta.'],
  ['Rosca martelo', 'Bíceps', 'Braquiorradial, antebraço', 'Halteres', 1, 'Com pegada neutra, flexione os cotovelos até os halteres chegarem aos ombros.', 'Punhos firmes e cotovelos parados.', 'Girar os punhos; balançar.'],
  ['Rosca Scott', 'Bíceps', 'Braquial', 'Máquina', 1, 'Braços apoiados no banco Scott, flexione e estenda quase por completo.', 'Axilas encaixadas no apoio.', 'Estender bruscamente no final; tirar os braços do apoio.'],
  ['Rosca na polia', 'Bíceps', 'Antebraço', 'Polia', 1, 'De frente para a polia baixa, flexione os cotovelos mantendo tensão contínua.', 'Cotovelos fixos, tronco ereto.', 'Inclinar o corpo para trás.'],
  // Tríceps
  ['Tríceps na polia (corda)', 'Tríceps', '—', 'Polia', 1, 'Estenda os cotovelos levando a corda para baixo e abra as mãos no final.', 'Cotovelos colados ao corpo, tronco levemente inclinado.', 'Mover os cotovelos; usar o peso do corpo.'],
  ['Tríceps na polia (barra)', 'Tríceps', '—', 'Polia', 1, 'Empurre a barra para baixo até estender os cotovelos.', 'Cotovelos fixos ao lado do tronco.', 'Abrir os cotovelos; subir a barra acima do peito.'],
  ['Tríceps francês', 'Tríceps', '—', 'Halteres', 2, 'Com o halter atrás da cabeça, estenda os cotovelos para cima.', 'Cotovelos apontados para frente, abdômen firme.', 'Abrir os cotovelos; arquear a lombar.'],
  ['Tríceps testa', 'Tríceps', '—', 'Barra', 2, 'Deitado, desça a barra em direção à testa flexionando só os cotovelos e estenda.', 'Braços perpendiculares ao corpo.', 'Mover os ombros; descer rápido.'],
  ['Mergulho no banco', 'Tríceps', 'Peito, ombros', 'Peso corporal', 1, 'Com as mãos no banco atrás do corpo, flexione os cotovelos e empurre de volta.', 'Ombros afastados das orelhas, tronco perto do banco.', 'Descer demais forçando o ombro.'],
  // Antebraço
  ['Rosca de punho', 'Antebraço', '—', 'Barra', 1, 'Antebraços apoiados, flexione os punhos levantando a barra.', 'Somente os punhos se movem.', 'Carga excessiva; amplitude curta.'],
  ['Rosca inversa', 'Antebraço', 'Bíceps, braquiorradial', 'Barra', 1, 'Com pegada pronada, flexione os cotovelos.', 'Cotovelos junto ao corpo.', 'Balançar o tronco.'],
  ['Caminhada do fazendeiro', 'Antebraço', 'Trapézio, core', 'Halteres', 1, 'Caminhe segurando halteres pesados ao lado do corpo.', 'Tronco ereto, ombros para trás.', 'Inclinar para um lado; encolher os ombros.'],
  // Trapézio
  ['Encolhimento com halteres', 'Trapézio', 'Antebraço', 'Halteres', 1, 'Eleve os ombros em direção às orelhas e desça controlando.', 'Braços estendidos, movimento vertical.', 'Girar os ombros; flexionar os cotovelos.'],
  ['Encolhimento com barra', 'Trapézio', 'Antebraço', 'Barra', 1, 'Segure a barra à frente do corpo e eleve os ombros.', 'Coluna neutra, olhar à frente.', 'Usar impulso das pernas.'],
  ['Remada alta', 'Trapézio', 'Deltoide lateral', 'Barra', 2, 'Puxe a barra rente ao corpo até a altura do peito, cotovelos acima das mãos.', 'Pegada na largura dos ombros.', 'Subir acima do peito (pode irritar o ombro).'],
  // Abdômen
  ['Prancha', 'Abdômen', 'Ombros, glúteos', 'Peso corporal', 1, 'Apoiado nos antebraços e pontas dos pés, mantenha o corpo reto pelo tempo definido.', 'Glúteos contraídos, quadril alinhado.', 'Quadril caído ou elevado; prender a respiração.'],
  ['Abdominal na polia', 'Abdômen', '—', 'Polia', 2, 'Ajoelhado, flexione o tronco levando os cotovelos em direção às coxas.', 'Quadril parado, movimento vem da coluna.', 'Puxar com os braços; sentar sobre os calcanhares.'],
  ['Abdominal supra', 'Abdômen', '—', 'Peso corporal', 1, 'Deitado com joelhos flexionados, eleve as escápulas do chão contraindo o abdômen.', 'Queixo afastado do peito, lombar no chão.', 'Puxar o pescoço com as mãos.'],
  ['Elevação de pernas', 'Abdômen', 'Flexores do quadril', 'Peso corporal', 2, 'Deitado ou pendurado, eleve as pernas e desça sem tocar o chão.', 'Lombar apoiada (no solo) ou sem balanço (na barra).', 'Arquear a lombar; usar impulso.'],
  ['Abdominal bicicleta', 'Abdômen', 'Oblíquos', 'Peso corporal', 1, 'Leve o cotovelo em direção ao joelho oposto alternando os lados.', 'Movimento controlado, lombar apoiada.', 'Fazer rápido demais; puxar o pescoço.'],
  ['Prancha lateral', 'Abdômen', 'Oblíquos, glúteo médio', 'Peso corporal', 1, 'Apoiado em um antebraço e na lateral do pé, mantenha o corpo alinhado.', 'Quadril elevado, corpo em linha reta.', 'Deixar o quadril cair.'],
  // Quadríceps
  ['Agachamento livre', 'Quadríceps', 'Glúteos, posterior, core', 'Barra', 2, 'Com a barra nas costas, flexione quadril e joelhos até pelo menos a linha paralela e suba.', 'Pés firmes, joelhos alinhados aos pés, coluna neutra.', 'Joelhos para dentro; tirar os calcanhares do chão; arredondar a lombar.'],
  ['Agachamento goblet', 'Quadríceps', 'Glúteos, core', 'Kettlebell', 1, 'Segurando o peso junto ao peito, agache e suba.', 'Tronco ereto, cotovelos por dentro dos joelhos.', 'Inclinar demais o tronco.'],
  ['Leg press 45°', 'Quadríceps', 'Glúteos, posterior', 'Máquina', 1, 'Desça a plataforma flexionando os joelhos até ~90° e empurre sem travar.', 'Lombar e quadril apoiados no encosto.', 'Tirar o quadril do banco; travar os joelhos com impacto.'],
  ['Cadeira extensora', 'Quadríceps', '—', 'Máquina', 1, 'Estenda os joelhos até quase travar e desça controlando.', 'Joelho alinhado ao eixo da máquina.', 'Chutar o peso; tirar o quadril do banco.'],
  ['Afundo', 'Quadríceps', 'Glúteos', 'Halteres', 1, 'Dê um passo à frente e desça até o joelho de trás quase tocar o chão.', 'Tronco ereto, joelho da frente alinhado ao pé.', 'Joelho da frente para dentro; passo curto demais.'],
  ['Agachamento búlgaro', 'Quadríceps', 'Glúteos', 'Halteres', 2, 'Com o pé de trás apoiado no banco, agache com a perna da frente.', 'Tronco levemente inclinado e estável.', 'Perder o equilíbrio; joelho para dentro.'],
  ['Hack machine', 'Quadríceps', 'Glúteos', 'Máquina', 2, 'Costas apoiadas, agache até ~90° e empurre.', 'Pés na largura dos ombros, costas coladas.', 'Amplitude curta; tirar os calcanhares.'],
  // Posterior de coxa
  ['Stiff', 'Posterior de coxa', 'Glúteos, lombar', 'Barra', 2, 'Com joelhos semiflexionados, desça a barra rente às pernas levando o quadril para trás e volte.', 'Coluna neutra durante todo o movimento.', 'Arredondar a coluna; dobrar demais os joelhos.'],
  ['Mesa flexora', 'Posterior de coxa', 'Panturrilhas', 'Máquina', 1, 'Deitado, flexione os joelhos trazendo o rolo em direção aos glúteos.', 'Quadril apoiado no banco.', 'Levantar o quadril; descer sem controle.'],
  ['Cadeira flexora', 'Posterior de coxa', '—', 'Máquina', 1, 'Sentado, flexione os joelhos empurrando o rolo para baixo.', 'Coxas presas pelo apoio, costas no encosto.', 'Amplitude curta; impulso.'],
  ['Levantamento terra romeno com halteres', 'Posterior de coxa', 'Glúteos', 'Halteres', 1, 'Leve o quadril para trás descendo os halteres até a metade da canela e volte.', 'Coluna neutra, halteres perto das pernas.', 'Arredondar a coluna.'],
  // Glúteos
  ['Elevação pélvica', 'Glúteos', 'Posterior de coxa', 'Barra', 2, 'Com as costas no banco e a barra no quadril, eleve o quadril até alinhar com o tronco.', 'Queixo levemente para baixo, costelas fechadas.', 'Hiperestender a lombar no topo.'],
  ['Abdução de quadril na máquina', 'Glúteos', 'Glúteo médio', 'Máquina', 1, 'Sentado, afaste as pernas contra a resistência e retorne controlando.', 'Tronco apoiado, movimento lento.', 'Usar impulso.'],
  ['Glúteo na polia (coice)', 'Glúteos', 'Posterior de coxa', 'Polia', 1, 'Com a tornozeleira na polia, estenda o quadril levando a perna para trás.', 'Abdômen firme, sem arquear a lombar.', 'Compensar com a coluna.'],
  ['Ponte de glúteo', 'Glúteos', 'Posterior de coxa', 'Peso corporal', 1, 'Deitado, eleve o quadril contraindo os glúteos.', 'Pés firmes e joelhos alinhados.', 'Empurrar com a lombar.'],
  // Panturrilhas
  ['Panturrilha em pé', 'Panturrilhas', '—', 'Máquina', 1, 'Eleve os calcanhares o máximo possível e desça alongando.', 'Joelhos estendidos sem travar.', 'Amplitude curta; quicar.'],
  ['Panturrilha sentado', 'Panturrilhas', 'Sóleo', 'Máquina', 1, 'Sentado, eleve os calcanhares e desça alongando.', 'Pausa no alongamento e na contração.', 'Movimento rápido.'],
  ['Panturrilha no leg press', 'Panturrilhas', '—', 'Máquina', 1, 'Com a ponta dos pés na plataforma, empurre estendendo os tornozelos.', 'Joelhos estendidos sem travar.', 'Deixar a plataforma escapar dos pés.'],
  // Funcional
  ['Burpee', 'Funcional', 'Corpo inteiro', 'Peso corporal', 2, 'Agache, apoie as mãos, jogue os pés para trás, faça uma flexão e salte.', 'Aterrissagem suave, core firme.', 'Lombar caída na prancha.'],
  ['Kettlebell swing', 'Funcional', 'Glúteos, posterior, core', 'Kettlebell', 2, 'Balance o kettlebell até a altura do peito com a força do quadril.', 'Movimento de dobradiça do quadril, não de agachamento.', 'Puxar com os braços; arredondar as costas.'],
  ['Mountain climber', 'Funcional', 'Abdômen, ombros', 'Peso corporal', 1, 'Em prancha alta, alterne os joelhos em direção ao peito rapidamente.', 'Quadril baixo e estável.', 'Elevar o quadril.'],
  ['Corda naval', 'Funcional', 'Ombros, core', 'Funcional', 2, 'Faça ondas alternadas ou simultâneas com as cordas.', 'Joelhos semiflexionados, tronco estável.', 'Movimentar só os braços sem usar o corpo.'],
  ['Polichinelo', 'Funcional', 'Panturrilhas, ombros', 'Peso corporal', 1, 'Salte abrindo pernas e braços e volte.', 'Aterrissagem na ponta dos pés.', 'Travar os joelhos.'],
];

const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const BUILTIN = RAW.map(([name, group, secondary, equipment, level, how, posture, errors]) => ({ id: slug(name), name, group, secondary, equipment, level, how, posture, errors, builtin: true }));

export function allExercises() {
  return [...BUILTIN, ...(S.customExercises || [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export const findExercise = name => {
  const k = name.trim().toLowerCase();
  return allExercises().find(e => e.name.toLowerCase() === k);
};

export const newCustomId = name => 'custom-' + slug(name) + '-' + Date.now().toString(36);

// Link para vídeos demonstrativos (abre uma busca no YouTube)
export const videoUrl = name => `https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' execução correta')}`;
