// Реальные диаметры труб (DN)
export const REAL_DN = [15, 20, 25, 32, 40, 50, 65, 80, 100, 125, 150];

// Типы альбомов КУУ
export const ALBUMS = {
  collector: 'Коллекторный',
  collector_pre_apt: 'Коллекторный с подключением перед квартирой',
  pre_apt: 'С подключением перед квартирой'
};

// Ключи альбомов для итерации
export const albumKeys = ['collector', 'collector_pre_apt', 'pre_apt'];

// Шаблоны BOM для КУУ
export const KUU_BOM_TEMPLATES = {
  collector: [
    { nameTpl: 'Кран шаровый Ду 32', qtyPerApt: 2, unit: 'шт' },
    { nameTpl: 'Кран шаровый Ду 15', qtyPerApt: 2, unit: 'шт' },
    { nameTpl: 'Фильтр сетчатый косой Ду 32', qtyPerApt: 2, unit: 'шт' },
    { nameTpl: 'Регулятор давления Ду 32', qtyPerApt: 2, unit: 'шт' },
    { nameTpl: 'Манометр', qtyPerApt: 2, unit: 'шт' },
    { nameTpl: 'Коллектор на {n} подключений', qtyPerApt: 2, unit: 'шт' },
    { nameTpl: 'Кран сливной Ду 15', qtyPerApt: 2, unit: 'шт' },
  ],
  collector_pre_apt: [],
  pre_apt: []
};

// Генератор уникальных идентификаторов
export function uid() {
  return Date.now() + Math.floor(Math.random() * 1e6);
}