export const BLOCKS = [
  { slug: 'logistica',      label: 'Logística',      modules: ['logistics'] },
  { slug: 'operaciones',    label: 'Operaciones',    modules: ['operations'] },
  { slug: 'administracion', label: 'Administración', modules: ['admin', 'administracion'] },
  { slug: 'gerencia',       label: 'Gerencia',       modules: ['gerente'] },
];

export const BLOCK_TO_MODULES = {
  logistica:      ['logistics'],
  operaciones:    ['operations'],
  administracion: ['admin', 'administracion'],
  gerencia:       ['gerente'],
};

export const BLOCK_LABELS = {
  logistica:      'Logística',
  operaciones:    'Operaciones',
  administracion: 'Administración',
  gerencia:       'Gerencia',
};

export const LEVEL_LABELS = {
  view: 'Ver',
  edit: 'Editar',
};
