import {
  sections,
  ensureSectionsCount,
  updateSectionFloors as stateUpdateSectionFloors,
  toggleLockFloors as stateToggleLockFloors,
  setApt as stateSetApt,
  setRentEnabled as stateSetRentEnabled,
  setRentQty as stateSetRentQty,
  autofillApts as stateAutofillApts,
  clearApts as stateClearApts,
  addZone as stateAddZone,
  removeZone as stateRemoveZone,
  clearZones as stateClearZones,
  updateZone as stateUpdateZone,
  updateZoneDia as stateUpdateZoneDia,
  toggleZoneLock as stateToggleZoneLock,
  setOnStateChange,
  serializeCalculatorState,
  loadCalculatorState,
  applyStateToDOM,
  readParamsFromDOM,
  getDefaultCalculatorState,
  calculatorParams,
  setSectionsFromImport,
  setMopLength as stateSetMopLength,
  setMopPosition as stateSetMopPosition
} from './state.js';

import { parseExcelFile, convertToSections } from './import.js';

import {
  computeFloorsData,
  computeZonesData,
  computeRisersByDiameter
} from './calculations.js';

import {
  renderSectionsBlocks,
  buildWaterSupplyHead,
  renderFloorsTable,
  renderWarnings,
  renderZonesSummary,
  renderRiserTotals,
  renderRiserByD,
  renderAlbumSummary,
  renderAlbumDetails,
  renderPipelinesBlock,
  renderFittingsBlock,
  renderCollectorsSummary,
  renderProjectsList,
  updateCurrentProjectName,
  closeAllProjectMenus,
  toggleProjectMenu,
  showModal,
  showConfirmDialog
} from './render.js';

import { exportToExcel } from './export.js';

import {
  loadProjects,
  saveProjects,
  getActiveProjectId,
  setActiveProjectId,
  createProject,
  findProjectById,
  updateProjectInList,
  removeProjectFromList
} from './storage.js';

import {
  initTabs,
  renderTabs,
  renderTabContent,
  getActiveTabId,
  setActiveTabId,
  setOnTabChange
} from './tabs.js';

// ===== Состояние приложения =====
let projects = [];
let activeProjectId = null;

// ===== Функции работы с проектами =====

// Сохранение текущего проекта
function saveCurrentProject() {
  if (!activeProjectId) return;

  readParamsFromDOM();
  const state = serializeCalculatorState();

  // Добавляем activeTabId в состояние проекта
  state.activeTabId = getActiveTabId();

  const project = findProjectById(projects, activeProjectId);
  if (project) {
    project.data = state;
    project.updatedAt = new Date().toISOString();
    saveProjects(projects);
    renderProjectsList(projects, activeProjectId);
  }
}

// Автосохранение при изменении состояния
function onStateChange() {
  saveCurrentProject();
}

// Переключение на проект
function switchToProject(projectId) {
  // Сохраняем текущий проект перед переключением
  if (activeProjectId && activeProjectId !== projectId) {
    saveCurrentProject();
  }

  const project = findProjectById(projects, projectId);
  if (!project) return;

  activeProjectId = projectId;
  setActiveProjectId(projectId);

  // Загружаем состояние проекта
  loadCalculatorState(project.data);
  applyStateToDOM();

  // Инициализация вкладок (берём activeTabId из проекта, если есть)
  const savedTabId = project.data?.activeTabId || 'residential';
  initTabs(savedTabId);

  // Рендер
  renderSectionsBlocks();
  calculateWaterSupply();
  renderProjectsList(projects, activeProjectId);
  updateCurrentProjectName(project.name);
}

// Создание нового проекта
function createNewProject(name) {
  const defaultState = getDefaultCalculatorState();
  const project = createProject(name || 'Новый проект', defaultState);

  projects.push(project);
  saveProjects(projects);

  switchToProject(project.id);
}

// Переименование проекта
function renameProjectById(projectId) {
  const project = findProjectById(projects, projectId);
  if (!project) return;

  closeAllProjectMenus();

  showModal('Переименовать проект', project.name, (newName) => {
    if (newName && newName !== project.name) {
      project.name = newName;
      project.updatedAt = new Date().toISOString();
      saveProjects(projects);
      renderProjectsList(projects, activeProjectId);

      if (projectId === activeProjectId) {
        updateCurrentProjectName(newName);
      }
    }
  });
}

// Удаление проекта
function deleteProjectById(projectId) {
  const project = findProjectById(projects, projectId);
  if (!project) return;

  closeAllProjectMenus();

  showConfirmDialog(
    'Удалить проект?',
    `Проект "${project.name}" будет удалён безвозвратно.`,
    () => {
      projects = removeProjectFromList(projects, projectId);
      saveProjects(projects);

      if (projectId === activeProjectId) {
        // Переключаемся на другой проект или создаём новый
        if (projects.length > 0) {
          switchToProject(projects[0].id);
        } else {
          createNewProject('Новый проект 1');
        }
      } else {
        renderProjectsList(projects, activeProjectId);
      }
    }
  );
}

// ===== Функции калькулятора =====

// Получение высот этажей из DOM
function getHeights() {
  const h1 = +document.getElementById('h1').value || 0;
  const hn = +document.getElementById('hn').value || 0;
  return { h1, hn };
}

// Основной расчёт и рендер
function calculateWaterSupply() {
  buildWaterSupplyHead();

  const { h1, hn } = getHeights();
  const ivptEnabled = document.getElementById('ivptEnabled')?.checked === true;

  // Расчёт данных по этажам
  const { floorsData, warnings } = computeFloorsData(sections, h1, hn);
  renderFloorsTable(floorsData);
  renderWarnings(warnings);

  // Расчёт данных по зонам
  const { zonesData, grandTotalRisersLen, byDiameter, byAlbum } = computeZonesData(sections, h1, hn, ivptEnabled);
  renderZonesSummary(zonesData);
  renderRiserTotals(grandTotalRisersLen);

  // Стояки по системам и диаметрам
  const risersByDiameter = computeRisersByDiameter(byDiameter);
  renderRiserByD(risersByDiameter);

  // Трубопроводы (блок в панели управления)
  renderPipelinesBlock(risersByDiameter, zonesData, h1, hn);

  // Подсчёт общего количества квартир и узлов учёта аренды
  let totalApartments = 0;
  let totalRentUnits = 0;
  sections.forEach(sec => {
    Object.keys(sec.apts).forEach(floor => {
      if (+floor > 1) { // квартиры только со 2-го этажа
        totalApartments += (sec.apts[floor] || 0);
      }
    });
    // Узлы учёта аренды (если аренда включена)
    if (sec.rent && sec.rent.enabled) {
      totalRentUnits += (sec.rent.qty || 0);
    }
  });

  // Арматура (блок в панели управления)
  renderFittingsBlock(totalApartments, ivptEnabled, zonesData, totalRentUnits);

  // Альбомы КУУ
  renderAlbumSummary(byAlbum);
  renderAlbumDetails(zonesData);

  // Сводка по коллекторам
  renderCollectorsSummary(zonesData);
}

// Полный пересчёт (ререндер карточек + расчёт)
function recalcAll() {
  renderSectionsBlocks();
  calculateWaterSupply();
}

// Обработчик изменения количества корпусов
function onSectionsCountChange() {
  const n = Math.max(1, +document.getElementById('numSections').value || 1);
  ensureSectionsCount(n);
  renderSectionsBlocks();
  calculateWaterSupply();
}

// ===== Импорт из Excel =====

// Показ статуса импорта
function showImportStatus(message, isError = false) {
  const statusEl = document.getElementById('importStatus');
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = `import-status ${isError ? 'error' : 'success'}`;
  statusEl.style.display = 'block';

  // Скрываем через 5 секунд
  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 5000);
}

// Обработка импорта из Excel
async function handleExcelImport() {
  const fileInput = document.getElementById('excelFileInput');
  const file = fileInput?.files?.[0];

  if (!file) {
    showImportStatus('Файл не выбран.', true);
    return;
  }

  // Показываем индикатор загрузки
  const btnImport = document.getElementById('btnImportExcel');
  const originalText = btnImport.textContent;
  btnImport.textContent = 'Загрузка...';
  btnImport.disabled = true;

  try {
    const result = await parseExcelFile(file);

    if (!result.success) {
      showImportStatus(result.error, true);
      return;
    }

    // Конвертируем в формат секций калькулятора
    const newSections = convertToSections(result.data);

    // Применяем к состоянию
    setSectionsFromImport(newSections);

    // Обновляем поле количества корпусов
    const numSectionsEl = document.getElementById('numSections');
    if (numSectionsEl) {
      numSectionsEl.value = newSections.length;
    }

    // Обновляем DOM
    applyStateToDOM();

    // Перерендериваем и пересчитываем
    renderSectionsBlocks();
    calculateWaterSupply();

    // Сохраняем проект
    saveCurrentProject();

    // Показываем успешное сообщение
    const stats = result.stats;
    showImportStatus(
      `Импортировано: ${stats.buildingsCount} корп., макс. этаж ${stats.maxFloor}, всего ${stats.totalApts} кв.`,
      false
    );

    // Сбрасываем input файла
    fileInput.value = '';
    btnImport.disabled = true;

  } catch (e) {
    console.error('Ошибка импорта:', e);
    showImportStatus(`Ошибка импорта: ${e.message || e}`, true);
  } finally {
    btnImport.textContent = originalText;
  }
}

// Обработчик выбора файла
function onExcelFileSelect() {
  const fileInput = document.getElementById('excelFileInput');
  const btnImport = document.getElementById('btnImportExcel');

  if (fileInput?.files?.length > 0) {
    btnImport.disabled = false;
  } else {
    btnImport.disabled = true;
  }
}

// ===== API для inline-обработчиков =====
window.app = {
  // Проекты
  switchProject(projectId) {
    switchToProject(projectId);
  },

  createProject() {
    const input = document.getElementById('newProjectName');
    const name = input?.value.trim() || '';
    createNewProject(name || 'Новый проект');
    if (input) input.value = '';
  },

  renameProject(projectId) {
    renameProjectById(projectId);
  },

  deleteProject(projectId) {
    deleteProjectById(projectId);
  },

  toggleProjectMenu(projectId) {
    toggleProjectMenu(projectId);
  },

  // Корпуса
  updateSectionFloors(si, val) {
    if (stateUpdateSectionFloors(si, val)) {
      recalcAll();
    }
  },

  toggleLockFloors(si, checked) {
    stateToggleLockFloors(si, checked);
    recalcAll();
  },

  // Квартиры
  setApt(si, f, val) {
    stateSetApt(si, f, val);
    calculateWaterSupply();
  },

  setRentEnabled(si, enabled) {
    stateSetRentEnabled(si, enabled);
    recalcAll();
  },

  setRentQty(si, qty) {
    stateSetRentQty(si, qty);
    calculateWaterSupply();
  },

  autofillApts(si) {
    const from = Math.max(2, +document.getElementById(`af_from_${si}`).value || 2);
    const to = Math.max(from, +document.getElementById(`af_to_${si}`).value || from);
    const qty = Math.max(0, +document.getElementById(`af_qty_${si}`).value || 0);

    const result = stateAutofillApts(si, from, to, qty);
    recalcAll();

    // Восстановить значения в полях после ререндера
    setTimeout(() => {
      const fromEl = document.getElementById(`af_from_${si}`);
      const toEl = document.getElementById(`af_to_${si}`);
      const qtyEl = document.getElementById(`af_qty_${si}`);
      if (fromEl) fromEl.value = result.from;
      if (toEl) toEl.value = result.to;
      if (qtyEl) qtyEl.value = result.qty;
    }, 0);
  },

  clearApts(si) {
    stateClearApts(si);
    recalcAll();
  },

  // Зоны
  addZone(si) {
    stateAddZone(si);
    recalcAll();
  },

  removeZone(si, zid) {
    stateRemoveZone(si, zid);
    recalcAll();
  },

  clearZones(si) {
    stateClearZones(si);
    recalcAll();
  },

  updateZone(si, zid, field, value) {
    stateUpdateZone(si, zid, field, value);
    recalcAll();
  },

  updateZoneDia(si, zid, sys, value) {
    stateUpdateZoneDia(si, zid, sys, value);
    // При изменении V1 меняются T3 и T4, при изменении T3 меняется T4
    if (sys === 'V1' || sys === 'T3') {
      recalcAll();
    } else {
      calculateWaterSupply();
    }
  },

  toggleZoneLock(si, zid, checked) {
    stateToggleZoneLock(si, zid, checked);
    recalcAll();
  },

  // МОП (сшитый полиэтилен)
  setMopLength(si, value) {
    stateSetMopLength(si, value);
    recalcAll();
  },

  setMopPosition(si, value) {
    stateSetMopPosition(si, value);
    recalcAll();
  }
};

// ===== Инициализация =====
window.onload = () => {
  // Устанавливаем callback для автосохранения
  setOnStateChange(onStateChange);

  // Устанавливаем callback для смены вкладки
  setOnTabChange((tabId) => {
    saveCurrentProject();
  });

  // Загружаем проекты из localStorage
  projects = loadProjects();
  activeProjectId = getActiveProjectId();

  // Если нет проектов — создаём дефолтный
  if (projects.length === 0) {
    createNewProject('Новый проект 1');
  } else {
    // Проверяем, существует ли активный проект
    const activeProject = findProjectById(projects, activeProjectId);
    if (!activeProject) {
      // Берём последний изменённый
      projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      activeProjectId = projects[0].id;
    }
    switchToProject(activeProjectId);
  }

  // Навешивание обработчиков на элементы калькулятора
  document.getElementById('numSections')?.addEventListener('change', onSectionsCountChange);

  document.getElementById('h1')?.addEventListener('change', () => {
    recalcAll();
    saveCurrentProject();
  });

  document.getElementById('hn')?.addEventListener('change', () => {
    recalcAll();
    saveCurrentProject();
  });

  document.getElementById('ivptEnabled')?.addEventListener('change', () => {
    calculateWaterSupply();
    saveCurrentProject();
  });

  document.getElementById('btnCalculate')?.addEventListener('click', calculateWaterSupply);

  document.getElementById('btnExport')?.addEventListener('click', () => {
    const project = findProjectById(projects, activeProjectId);
    exportToExcel(calculateWaterSupply, getHeights, project?.name);
  });

  // Обработчик создания проекта
  document.getElementById('btnCreateProject')?.addEventListener('click', () => {
    window.app.createProject();
  });

  // Enter в поле имени проекта
  document.getElementById('newProjectName')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      window.app.createProject();
    }
  });

  // Закрытие меню при клике вне
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.project-menu') && !e.target.closest('.project-menu-btn')) {
      closeAllProjectMenus();
    }
  });

  // Обработчики импорта из Excel
  document.getElementById('excelFileInput')?.addEventListener('change', onExcelFileSelect);
  document.getElementById('btnImportExcel')?.addEventListener('click', handleExcelImport);
};
