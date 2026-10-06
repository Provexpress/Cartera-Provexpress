/**
 * Directorio comercial corporativo de Provexpress SAS.
 * Adaptado e integrado desde la estructura oficial del proyecto ForeCast 2026.
 */

export interface CommercialEntry {
  email: string;
  nombre: string;
  grupo: number;
  directorNombre: string;
  directorEmail: string;
  archivo?: string;
  aliases?: string[];
  genero: 'M' | 'F';
}

export const ESTRUCTURA_COMERCIAL_2026: {
  gerencia: string[];
  directores: Record<string, { grupo: number; nombre: string; carpeta: string; genero: 'M' | 'F'; aliases?: string[] }>;
  ejecutivos: Record<string, { grupo: number; nombre: string; archivo: string; genero: 'M' | 'F'; aliases?: string[] }>;
} = {
  gerencia: [
    'juannovoa@provexpress.com.co',
    'rafael.novoa@provexpress.com.co',
    'rafaelnovoa@provexpress.com.co',
    'c.estrategica@provexpress.com.co',
    'jefe.operaciones@provexpress.com.co',
    'nini.beltran@provexpress.com.co',
    'maribel.virguez@provexpress.com.co',
    'especialista.preventa@provexpress.com.co',
    'preventa.software@provexpress.com.co',
  ],
  directores: {
    'rafael.novoa@provexpress.com.co': {
      grupo: 1,
      nombre: 'Rafael Novoa',
      carpeta: 'Grupo Rafael Novoa',
      genero: 'M',
      aliases: ['Rafael Francisco Nov', 'Rafael Francisco Novoa'],
    },
    'rafaelnovoa@provexpress.com.co': {
      grupo: 1,
      nombre: 'Rafael Novoa',
      carpeta: 'Grupo Rafael Novoa',
      genero: 'M',
      aliases: ['Rafael Francisco Nov', 'Rafael Francisco Novoa'],
    },
    'angelica.caballero@provexpress.com.co': {
      grupo: 2,
      nombre: 'Angélica Caballero',
      carpeta: 'Grupo Maria Angelica caballero',
      genero: 'F',
      aliases: ['Maria Angelica Cabal', 'Maria Angelica Caballero', 'María Angélica Caballero'],
    },
    'oscar.beltran@provexpress.com.co': {
      grupo: 3,
      nombre: 'Óscar Beltrán',
      carpeta: 'Grupo Oscar Beltran',
      genero: 'M',
      aliases: ['Oscar Alejandro Belt', 'Oscar Alejandro Beltrán'],
    },
    'miller.romero@provexpress.com.co': {
      grupo: 4,
      nombre: 'Miller Romero',
      carpeta: 'Grupo Miller Romero',
      genero: 'M',
      aliases: ['Miller Leonardo Rome', 'Miller Leonardo Romero'],
    },
  },
  ejecutivos: {
    // Grupo 1: Novoa
    'rosmira.rojas@provexpress.com.co': { grupo: 1, nombre: 'Rosmira Rojas', archivo: 'Rosmira Rojas.xlsx', genero: 'F', aliases: ['Rosmira Rojas Puente'] },
    'mario.reyes@provexpress.com.co': { grupo: 1, nombre: 'Mario Reyes', archivo: 'Mario Reyes.xlsx', genero: 'M', aliases: ['Mario Reyes Gutierre'] },
    'wilson.sanchez@provexpress.com.co': { grupo: 1, nombre: 'Wilson Sánchez', archivo: 'Wilson Fernando Sánchez.xlsx', genero: 'M', aliases: ['Wilson Fernando Sanc', 'Wilson Fernando Sánchez'] },
    'maria.cruz@provexpress.com.co': { grupo: 1, nombre: 'María Eugenia Cruz', archivo: 'Maria Eugenia Cruz.xlsx', genero: 'F', aliases: ['Maria Eugenia Cruz H', 'Maria Eugenia Cruz'] },
    'javier.cortes@provexpress.com.co': { grupo: 1, nombre: 'Javier Cortés', archivo: 'Javier Cortés.xlsx', genero: 'M', aliases: ['Javier Antonio Corte', 'Javier Antonio Cortés'] },
    'rosa.mendoza@provexpress.com.co': { grupo: 1, nombre: 'Rosa Mendoza', archivo: 'Rosa María Mendoza.xlsx', genero: 'F', aliases: ['Rosa Maria Mendoza M', 'Rosa María Mendoza'] },
    'mariela.ramirez@provexpress.com.co': { grupo: 1, nombre: 'Mariela Ramírez', archivo: 'Mariela Ramírez.xlsx', genero: 'F', aliases: ['Mariela Ramírez Cast', 'Mariela Ramírez'] },
    'jenny.gonzalez@provexpress.com.co': { grupo: 1, nombre: 'Jenny Gónzalez', archivo: 'Jenny Gónzalez.xlsx', genero: 'F', aliases: ['Jenny Alexandra Gonz', 'Jenny Alexandra González'] },
    'julieth.galindo@provexpress.com.co': { grupo: 1, nombre: 'Julieth Galindo', archivo: 'Julieth Galindo.xlsx', genero: 'F', aliases: ['Julieth Milena Galin', 'Julieth Milena Galindo'] },

    // Grupo 2: Caballero
    'angela.torres@provexpress.com.co': { grupo: 2, nombre: 'Ángela Torres', archivo: 'Ángela Torres.xlsx', genero: 'F', aliases: ['Angela Rocio Torres', 'Ángela Rocío Torres'] },
    'andrea.vargas@provexpress.com.co': { grupo: 2, nombre: 'Yurany Andrea Vargas', archivo: 'Yurany Andrea Vargas.xlsx', genero: 'F', aliases: ['Yurany Andrea Vargas'] },
    'alejandra.velasquez@provexpress.com.co': { grupo: 2, nombre: 'Alejandra Velásquez', archivo: 'Alejandra Velásquez.xlsx', genero: 'F', aliases: ['Maria Alejandra Velá', 'María Alejandra Velásquez'] },
    'fernando.quinonez@provexpress.com.co': { grupo: 2, nombre: 'Fernando Quiñonez', archivo: 'Fernando Quiñonez.xlsx', genero: 'M', aliases: ['Fernando Alberto Qui', 'Fernando Alberto Quiñonez'] },
    'johana.mojica@provexpress.com.co': { grupo: 2, nombre: 'Jasbleidy Mójica', archivo: 'Jasbleidy Mójica.xlsx', genero: 'F', aliases: ['Jasbleidy Johana Moj', 'Jasbleidy Johana Mójica'] },
    'johanna.jaime@provexpress.com.co': { grupo: 2, nombre: 'Johanna Jaime', archivo: 'Johanna Jaime.xlsx', genero: 'F', aliases: ['Johanna Jaime Murcia'] },
    'dayana.chala@provexpress.com.co': { grupo: 2, nombre: 'Dayana Chala', archivo: 'Dayana Chala.xlsx', genero: 'F', aliases: ['Dayana Marcela Chala'] },
    'yovanny.herrera@provexpress.com.co': { grupo: 2, nombre: 'Yovanny Herrera', archivo: 'Yovanny Herrera.xlsx', genero: 'M', aliases: ['Jair Yovanny Herrea', 'Jair Yovanny Herrera'] },
    'cesar.cespedes@provexpress.com.co': { grupo: 2, nombre: 'César Céspedes', archivo: 'César Cespedes.xlsx', genero: 'M', aliases: ['Cesar Augusto Cesped', 'César Augusto Céspedes'] },
    'daniel.galindo@provexpress.com.co': { grupo: 2, nombre: 'Daniel Galindo', archivo: 'Daniel Galindo.xlsx', genero: 'M', aliases: ['Daniel Galindo Giron', 'Daniel Galindo Girón'] },
    'adriana.cucaita@provexpress.com.co': { grupo: 2, nombre: 'Adriana Cucaita', archivo: 'Adriana Cucaita.xlsx', genero: 'F', aliases: ['Adriana Cucaita Boni', 'Adriana Cucaita Bonilla'] },

    // Grupo 3: Beltrán
    'paola.garcia@provexpress.com.co': { grupo: 3, nombre: 'Gina García', archivo: 'Gina García.xlsx', genero: 'F', aliases: ['Gina Paola Garcia Qu', 'Gina Paola García'] },
    'karen.carrillo@provexpress.com.co': { grupo: 3, nombre: 'Karent Carrillo', archivo: 'Karent Carrillo.xlsx', genero: 'F', aliases: ['Karent Carrillo Mari', 'Karent Carrillo'] },
    'lington.linares@provexpress.com.co': { grupo: 3, nombre: 'Lington Linares', archivo: 'Lington Linares.xlsx', genero: 'M', aliases: ['Lington Linares Lina'] },
    'angelica.alvarez@provexpress.com.co': { grupo: 3, nombre: 'Angélica Álvarez', archivo: 'Angélica Álvarez.xlsx', genero: 'F', aliases: ['Maria Angelica Alvar', 'Maria Angelica Alvarez Morales', 'María Angélica Álvarez Morales'] },
    'andres.pena@provexpress.com.co': { grupo: 3, nombre: 'Andrés Peña', archivo: 'Andrés Peña.xlsx', genero: 'M', aliases: ['Freddy Andres Peña S', 'Freddy Andrés Peña'] },
    'tatiana.parra@provexpress.com.co': { grupo: 3, nombre: 'Tatiana Parra', archivo: 'Tatiana Parra.xlsx', genero: 'F', aliases: ['Angie Tatiana Parra'] },
    'claudia.triana@provexpress.com.co': { grupo: 3, nombre: 'Claudia Triana', archivo: 'Claudia Triana.xlsx', genero: 'F', aliases: ['Claudia Patricia Tri', 'Claudia Patricia Triana'] },
    'dilma.cuesta@provexpress.com.co': { grupo: 3, nombre: 'Dilma Cuesta', archivo: 'Dilma Cuesta.xlsx', genero: 'F', aliases: ['Dilma Constanza Cues', 'Dilma Constanza Cuesta'] },
    'juan.martinez@provexpress.com.co': { grupo: 3, nombre: 'Juan Martínez', archivo: 'Juan Martínez.xlsx', genero: 'M', aliases: ['Juan David Martínez', 'Juan David Martinez'] },
    'deisy.mogollon@provexpress.com.co': { grupo: 3, nombre: 'Deisy Mogollón', archivo: 'Deisy Mogollón.xlsx', genero: 'F', aliases: ['Deisy Mogollón', 'Deisy Mogollon'] },

    // Grupo 4: Romero
    'astrid.jimenez@provexpress.com.co': { grupo: 4, nombre: 'Astrid Jiménez', archivo: 'Astrid Jiménez.xlsx', genero: 'F', aliases: ['Leidy Astrid Jimenez', 'Leidy Astrid Jiménez'] },
    'maria.briceno@provexpress.com.co': { grupo: 4, nombre: 'María Paola Briceño', archivo: 'María Paola Briceño.xlsx', genero: 'F', aliases: ['Maria Paola Briceño', 'María Paola Briceño'] },
    'dafne.ruiz@provexpress.com.co': { grupo: 4, nombre: 'Dafne Ruiz', archivo: 'Dafne Lizeth Ruiz.xlsx', genero: 'F', aliases: ['Dafne Lizeth Ruiz Be', 'Dafne Lizeth Ruiz'] },
    'jessica.valencia@provexpress.com.co': { grupo: 4, nombre: 'Jessica Valencia', archivo: 'Jessica Valencia.xlsx', genero: 'F', aliases: ['Jessica Lorena Valen', 'Jessica Lorena Valencia'] },
    'jhonatan.acevedo@provexpress.com.co': { grupo: 4, nombre: 'Jhonatan Acevedo', archivo: 'Jhonatan Acevedo.xlsx', genero: 'M', aliases: ['Jhonatan Steven Acev', 'Jhonatan Steven Acevedo'] },
    'camilo.hernandez@provexpress.com.co': { grupo: 4, nombre: 'Camilo Hernández', archivo: 'Jhonatan Camilo Hernández.xlsx', genero: 'M', aliases: ['Jhonatan Camilo Hern', 'Jhonatan Camilo Hernández'] },
    'yeison.urrego@provexpress.com.co': { grupo: 4, nombre: 'Yeison Urrego', archivo: 'Yeison Urrego.xlsx', genero: 'M', aliases: ['Yeison Alonso Urrego'] },
    'diana.castro@provexpress.com.co': { grupo: 4, nombre: 'Diana Castro', archivo: 'Diana Catalina Castro.xlsx', genero: 'F', aliases: ['Diana Catalina Castr', 'Diana Catalina Castro'] },
  },
};

export function normalizeEmail(value: unknown): string {
  return String(value || '').toLowerCase().trim();
}

export function normalizeName(value: unknown): string {
  return String(value || '')
    .replace(/\.(xlsx|xls)$/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const DIRECTORES_BY_GRUPO: Record<number, { nombre: string; email: string; genero: 'M' | 'F' }> = {
  1: { nombre: 'Rafael Novoa', email: 'rafael.novoa@provexpress.com.co', genero: 'M' },
  2: { nombre: 'Angélica Caballero', email: 'angelica.caballero@provexpress.com.co', genero: 'F' },
  3: { nombre: 'Óscar Beltrán', email: 'oscar.beltran@provexpress.com.co', genero: 'M' },
  4: { nombre: 'Miller Romero', email: 'miller.romero@provexpress.com.co', genero: 'M' },
};

/**
 * Busca el correo de un ejecutivo a partir de su nombre o alias registrado en Excel.
 */
function levenshteinDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const upper = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = upper;
    }
  }
  return previous[b.length];
}

function tokenMatches(token: string, candidateList: string[]): boolean {
  if (candidateList.includes(token)) return true;
  return candidateList.some((cand) => {
    if (cand === token) return true;
    const shorter = cand.length <= token.length ? cand : token;
    const longer = cand.length > token.length ? cand : token;
    if (shorter.length >= 3 && longer.startsWith(shorter)) return true;
    if (token.length >= 5 && cand.length >= 5 && levenshteinDistance(token, cand) <= 1) return true;
    return false;
  });
}

/**
 * Comparación segura de nombres con protección contra colisiones de apellidos.
 * Dos personas con nombres de pila idénticos (p. ej. María Angélica) pero apellidos
 * distintos (Álvarez vs Caballero) NUNCA coincidirán.
 */
export function nameMatches(fullName: string, targetName: string): boolean {
  const normFull = normalizeName(fullName);
  const normTarget = normalizeName(targetName);
  if (!normFull || !normTarget) return false;
  if (normFull === normTarget) return true;

  const fullTokens = normFull.split(' ').filter((t) => t.length >= 3);
  const targetTokens = normTarget.split(' ').filter((t) => t.length >= 3);

  if (!fullTokens.length || !targetTokens.length) return false;

  // Si uno está completamente contenido como subcadena continua del otro
  if (normFull.includes(normTarget) || normTarget.includes(normFull)) {
    return true;
  }

  // PROTECCIÓN ESTRICTA DE APELLIDOS:
  // En nombres hispanos, el último token (o token truncado en ERP) corresponde al apellido.
  // Si el último token de target no coincide con ningún token de full,
  // Y el último token de full no coincide con ningún token de target,
  // los apellidos están en conflicto directo -> NUNCA deben emparejarse.
  const lastTarget = targetTokens[targetTokens.length - 1];
  const lastFull = fullTokens[fullTokens.length - 1];

  const lastTargetMatched = tokenMatches(lastTarget, fullTokens);
  const lastFullMatched = tokenMatches(lastFull, targetTokens);

  if (!lastTargetMatched && !lastFullMatched) {
    return false; // Conflicto de apellidos
  }

  const matched = targetTokens.filter((t) => tokenMatches(t, fullTokens));
  return matched.length >= 2 || (targetTokens.length === 1 && matched.length === 1);
}

export function getExecutiveEmailByName(name: string): string {
  const target = normalizeName(name);
  if (!target) return '';

  const entries = Object.entries(ESTRUCTURA_COMERCIAL_2026.ejecutivos);

  // 1. Coincidencia exacta de nombre, archivo o alias
  for (const [email, data] of entries) {
    if (
      normalizeName(data.nombre) === target ||
      normalizeName(data.archivo) === target ||
      (data.aliases && data.aliases.some((a) => normalizeName(a) === target))
    ) {
      return email;
    }
  }

  // 2. Coincidencia por nameMatches seguro
  for (const [email, data] of entries) {
    if (
      nameMatches(name, data.nombre) ||
      nameMatches(name, data.archivo) ||
      (data.aliases && data.aliases.some((a) => nameMatches(name, a)))
    ) {
      return email;
    }
  }

  return '';
}

export interface ResolvedCommercialRole {
  type: 'ejecutivo' | 'director_directa' | 'unassigned';
  email: string;
  nombre: string;
  grupo: number;
  directorNombre: string;
  directorEmail: string;
  genero: 'M' | 'F';
}

export function resolveCommercialOrDirector(name: string): ResolvedCommercialRole {
  const target = normalizeName(name);
  if (!target) {
    return {
      type: 'unassigned',
      email: '',
      nombre: name || 'Cuentas Especiales',
      grupo: 0,
      directorNombre: 'Otras Áreas / Especiales',
      directorEmail: '',
      genero: getCommercialGender(name),
    };
  }

  // 1. Probar contra ejecutivos comerciales (coincidencia exacta de nombre, archivo o alias)
  const execEntries = Object.entries(ESTRUCTURA_COMERCIAL_2026.ejecutivos);
  for (const [email, exec] of execEntries) {
    if (
      normalizeName(exec.nombre) === target ||
      normalizeName(exec.archivo) === target ||
      (exec.aliases && exec.aliases.some((a) => normalizeName(a) === target))
    ) {
      const dir = DIRECTORES_BY_GRUPO[exec.grupo] || { nombre: 'Dirección Comercial', email: '', genero: 'M' as const };
      return {
        type: 'ejecutivo',
        email,
        nombre: exec.nombre,
        grupo: exec.grupo,
        directorNombre: dir.nombre,
        directorEmail: dir.email,
        genero: exec.genero,
      };
    }
  }

  // 2. Probar contra directores (coincidencia exacta de nombre, carpeta o alias)
  for (const dir of LISTA_DIRECTORES) {
    if (
      normalizeName(dir.nombre) === target ||
      normalizeName(dir.carpeta) === target ||
      (dir.aliases && dir.aliases.some((a) => normalizeName(a) === target))
    ) {
      return {
        type: 'director_directa',
        email: dir.email,
        nombre: dir.nombre,
        grupo: dir.grupo,
        directorNombre: dir.nombre,
        directorEmail: dir.email,
        genero: dir.genero,
      };
    }
  }

  // 3. Probar contra ejecutivos comerciales por nameMatches seguro (protección de apellidos)
  for (const [email, exec] of execEntries) {
    if (
      nameMatches(name, exec.nombre) ||
      nameMatches(name, exec.archivo) ||
      (exec.aliases && exec.aliases.some((a) => nameMatches(name, a)))
    ) {
      const dir = DIRECTORES_BY_GRUPO[exec.grupo] || { nombre: 'Dirección Comercial', email: '', genero: 'M' as const };
      return {
        type: 'ejecutivo',
        email,
        nombre: exec.nombre,
        grupo: exec.grupo,
        directorNombre: dir.nombre,
        directorEmail: dir.email,
        genero: exec.genero,
      };
    }
  }

  // 4. Probar contra directores por nameMatches seguro
  for (const dir of LISTA_DIRECTORES) {
    if (
      nameMatches(name, dir.nombre) ||
      (dir.aliases && dir.aliases.some((a) => nameMatches(name, a)))
    ) {
      return {
        type: 'director_directa',
        email: dir.email,
        nombre: dir.nombre,
        grupo: dir.grupo,
        directorNombre: dir.nombre,
        directorEmail: dir.email,
        genero: dir.genero,
      };
    }
  }

  // 5. Sin asignar a la fuerza comercial (Cuentas Especiales / Otras Áreas)
  return {
    type: 'unassigned',
    email: '',
    nombre: name || 'Cuentas Especiales',
    grupo: 0,
    directorNombre: 'Otras Áreas / Especiales',
    directorEmail: '',
    genero: getCommercialGender(name),
  };
}

/**
 * Obtiene la información completa del comercial para el envío de notificaciones.
 */
export function getCommercialInfo(nameOrEmail: string): CommercialEntry {
  const normalized = normalizeEmail(nameOrEmail);

  // Si ya es un email conocido
  if (normalized.includes('@') && ESTRUCTURA_COMERCIAL_2026.ejecutivos[normalized]) {
    const data = ESTRUCTURA_COMERCIAL_2026.ejecutivos[normalized];
    const dir = DIRECTORES_BY_GRUPO[data.grupo] || { nombre: 'Dirección Comercial', email: '', genero: 'M' as const };
    return {
      email: normalized,
      nombre: data.nombre,
      grupo: data.grupo,
      directorNombre: dir.nombre,
      directorEmail: dir.email,
      archivo: data.archivo,
      genero: data.genero,
    };
  }

  // Si es un nombre
  const email = getExecutiveEmailByName(nameOrEmail);
  if (email && ESTRUCTURA_COMERCIAL_2026.ejecutivos[email]) {
    const data = ESTRUCTURA_COMERCIAL_2026.ejecutivos[email];
    const dir = DIRECTORES_BY_GRUPO[data.grupo] || { nombre: 'Dirección Comercial', email: '', genero: 'M' as const };
    return {
      email,
      nombre: data.nombre,
      grupo: data.grupo,
      directorNombre: dir.nombre,
      directorEmail: dir.email,
      archivo: data.archivo,
      genero: data.genero,
    };
  }

  // Fallback seguro con detección heurística de género
  const fallbackGender = getCommercialGender(nameOrEmail);
  return {
    email: normalized.includes('@') ? normalized : '',
    nombre: nameOrEmail,
    grupo: 0,
    directorNombre: 'Dirección Comercial',
    directorEmail: '',
    genero: fallbackGender,
  };
}

export interface DirectorInfo {
  grupo: number;
  nombre: string;
  email: string;
  carpeta: string;
  genero: 'M' | 'F';
  aliases?: string[];
}

export const LISTA_DIRECTORES: DirectorInfo[] = [
  { grupo: 1, nombre: 'Rafael Novoa', email: 'rafael.novoa@provexpress.com.co', carpeta: 'Grupo Rafael Novoa', genero: 'M', aliases: ['Rafael Francisco Nov', 'Rafael Francisco Novoa'] },
  { grupo: 2, nombre: 'Angélica Caballero', email: 'angelica.caballero@provexpress.com.co', carpeta: 'Grupo Maria Angelica caballero', genero: 'F', aliases: ['Maria Angelica Cabal', 'Maria Angelica Caballero', 'María Angélica Caballero'] },
  { grupo: 3, nombre: 'Óscar Beltrán', email: 'oscar.beltran@provexpress.com.co', carpeta: 'Grupo Oscar Beltran', genero: 'M', aliases: ['Oscar Alejandro Belt', 'Oscar Alejandro Beltrán'] },
  { grupo: 4, nombre: 'Miller Romero', email: 'miller.romero@provexpress.com.co', carpeta: 'Grupo Miller Romero', genero: 'M', aliases: ['Miller Leonardo Rome', 'Miller Leonardo Romero'] },
];

export interface GerenciaInfo {
  cargo: string;
  nombre: string;
  email: string;
  genero: 'M' | 'F';
}

export const LISTA_GERENCIA: GerenciaInfo[] = [
  { cargo: 'Director Comercial', nombre: 'Rafael Novoa', email: 'rafael.novoa@provexpress.com.co', genero: 'M' },
  { cargo: 'Gerente General / Comercial', nombre: 'Juan Novoa', email: 'juannovoa@provexpress.com.co', genero: 'M' },
  { cargo: 'Gerencia Estratégica', nombre: 'Cuentas Estratégicas', email: 'c.estrategica@provexpress.com.co', genero: 'M' },
  { cargo: 'Jefatura de Operaciones', nombre: 'Jefe de Operaciones', email: 'jefe.operaciones@provexpress.com.co', genero: 'M' },
  { cargo: 'Especialista Preventa', nombre: 'Especialista Preventa', email: 'especialista.preventa@provexpress.com.co', genero: 'M' },
];

export function getDirectorInfo(emailOrGroup: string | number): DirectorInfo | null {
  if (typeof emailOrGroup === 'number') {
    return LISTA_DIRECTORES.find((d) => d.grupo === emailOrGroup) || null;
  }
  const norm = normalizeEmail(emailOrGroup);
  return (
    LISTA_DIRECTORES.find((d) => normalizeEmail(d.email) === norm || normalizeName(d.nombre) === normalizeName(emailOrGroup)) ||
    null
  );
}

/**
 * Determina si una persona (ejecutivo o director) es de género femenino ('F') o masculino ('M').
 */
export function getCommercialGender(nameOrEmail: string): 'M' | 'F' {
  const norm = normalizeName(nameOrEmail);
  const emailNorm = normalizeEmail(nameOrEmail);

  // 1. Directores
  for (const d of LISTA_DIRECTORES) {
    if (normalizeEmail(d.email) === emailNorm || normalizeName(d.nombre) === norm) {
      return d.genero;
    }
  }

  // 2. Ejecutivos
  for (const [email, data] of Object.entries(ESTRUCTURA_COMERCIAL_2026.ejecutivos)) {
    if (normalizeEmail(email) === emailNorm || normalizeName(data.nombre) === norm || normalizeName(data.archivo) === norm) {
      return data.genero;
    }
  }

  // 3. Nombres femeninos conocidos
  const firstToken = norm.split(' ')[0] || '';
  const femaleKeywords = [
    'rosmira', 'maria', 'rosa', 'mariela', 'jenny', 'julieth', 'angela', 'andrea',
    'alejandra', 'jasbleidy', 'johanna', 'johana', 'dayana', 'adriana', 'paola',
    'gina', 'karent', 'karen', 'angelica', 'tatiana', 'claudia', 'dilma', 'deisy',
    'astrid', 'dafne', 'jessica', 'diana', 'nini', 'maribel', 'carolina', 'angie', 'laura'
  ];

  if (femaleKeywords.includes(firstToken)) return 'F';
  if (firstToken.endsWith('a') && !['joshua', 'luca'].includes(firstToken)) return 'F';

  return 'M';
}


