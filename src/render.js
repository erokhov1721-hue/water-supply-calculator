import { REAL_DN, ALBUMS, albumKeys } from './constants.js';
import { sections } from './state.js';
import { formatDate, getProjectStats } from './storage.js';
import { sectionZoneForFloor, computeMopPexLengthsForSection } from './calculations.js';

// ===== Рендер панели проектов =====

// Рендер списка проектов
export function renderProjectsList(projects, activeProjectId) {
  const container = document.getElementById('projectsList');
  if (!container) return;

  if (!projects.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Нет проектов</p>
        <p>Создайте первый проект выше</p>
      </div>
    `;
    return;
  }

  const html = projects
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map(project => {
      const stats = getProjectStats(project);
      const isActive = project.id === activeProjectId;

      return `
        <div class="project-card ${isActive ? 'active' : ''}" data-project-id="${project.id}">
          <div class="project-card-header">
            <div class="project-name">${escapeHtml(project.name)}</div>
            <button class="project-menu-btn" onclick="event.stopPropagation(); window.app.toggleProjectMenu('${project.id}')">⋮</button>
          </div>
          <div class="project-stats">
            ${stats.sectionsCount} корп. / ${stats.totalFloors} эт. / ${stats.totalApts} кв.
          </div>
          <div class="project-dates">
            Изменён: ${formatDate(project.updatedAt)}
          </div>
          <div class="project-menu" id="menu-${project.id}">
            <button onclick="event.stopPropagation(); window.app.renameProject('${project.id}')">Переименовать</button>
            <button class="danger" onclick="event.stopPropagation(); window.app.deleteProject('${project.id}')">Удалить</button>
          </div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="projects-list-title">Мои проекты</div>
    ${html}
  `;

  // Навешиваем обработчики клика на карточки
  container.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.project-menu-btn') || e.target.closest('.project-menu')) return;
      const projectId = card.dataset.projectId;
      window.app.switchProject(projectId);
    });
  });
}

// Обновление имени проекта в шапке
export function updateCurrentProjectName(name) {
  const el = document.getElementById('currentProjectName');
  if (el) {
    el.textContent = name || 'Без названия';
  }
}

// Закрытие всех меню проектов
export function closeAllProjectMenus() {
  document.querySelectorAll('.project-menu').forEach(menu => {
    menu.classList.remove('show');
  });
}

// Переключение меню проекта
export function toggleProjectMenu(projectId) {
  const menu = document.getElementById(`menu-${projectId}`);
  if (!menu) return;

  const wasOpen = menu.classList.contains('show');
  closeAllProjectMenus();

  if (!wasOpen) {
    menu.classList.add('show');
  }
}

// Показ модального окна
export function showModal(title, inputValue, onConfirm, onCancel) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>${escapeHtml(title)}</h3>
      <input type="text" id="modalInput" value="${escapeHtml(inputValue || '')}" placeholder="Введите название...">
      <div class="modal-buttons">
        <button class="btn-danger" id="modalCancel">Отмена</button>
        <button class="btn-secondary" id="modalConfirm">Подтвердить</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const input = overlay.querySelector('#modalInput');
  input.focus();
  input.select();

  const close = () => {
    overlay.remove();
  };

  overlay.querySelector('#modalCancel').addEventListener('click', () => {
    close();
    if (onCancel) onCancel();
  });

  overlay.querySelector('#modalConfirm').addEventListener('click', () => {
    const value = input.value.trim();
    close();
    if (onConfirm) onConfirm(value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const value = input.value.trim();
      close();
      if (onConfirm) onConfirm(value);
    } else if (e.key === 'Escape') {
      close();
      if (onCancel) onCancel();
    }
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      close();
      if (onCancel) onCancel();
    }
  });
}

// Показ диалога подтверждения
export function showConfirmDialog(title, message, onConfirm, onCancel) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>${escapeHtml(title)}</h3>
      <p style="margin-bottom: 16px; color: #666;">${escapeHtml(message)}</p>
      <div class="modal-buttons">
        <button class="btn-secondary" id="modalCancel">Отмена</button>
        <button class="btn-danger" id="modalConfirm">Удалить</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
  };

  overlay.querySelector('#modalCancel').addEventListener('click', () => {
    close();
    if (onCancel) onCancel();
  });

  overlay.querySelector('#modalConfirm').addEventListener('click', () => {
    close();
    if (onConfirm) onConfirm();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      close();
      if (onCancel) onCancel();
    }
  });
}

// Экранирование HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== Рендер калькулятора =====

// Рендер select для диаметра
function renderDnSelect(currentValue, onChangeJs, disabled) {
  const options = REAL_DN.map(d => `<option value="${d}" ${+currentValue === d ? 'selected' : ''}>${d}</option>`).join('');
  return `<select ${disabled ? 'disabled' : ''} onchange="${onChangeJs}">${options}</select>`;
}

// Рендер таблицы квартир корпуса
function renderFloorsTableForSection(si) {
  const sec = sections[si];
  const numFloors = sec.floors;
  let rows = '';

  for (let f = 1; f <= numFloors; f++) {
    const isFirst = f === 1;
    const aptVal = isFirst ? 0 : (sec.apts[f] ?? 0);
    const aptCell = isFirst
      ? `<input type="number" value="0" disabled/>`
      : `<input type="number" min="0" max="200" value="${aptVal}" oninput="window.app.setApt(${si}, ${f}, +this.value)">`;

    const rentCells = isFirst
      ? `
        <td>
          <select onchange="window.app.setRentEnabled(${si}, this.value==='yes');">
            <option value="no" ${!sec.rent.enabled ? 'selected' : ''}>Нет</option>
            <option value="yes" ${sec.rent.enabled ? 'selected' : ''}>Да</option>
          </select>
        </td>
        <td>
          <input type="number" min="0" step="1" value="${sec.rent.qty}"
            ${sec.rent.enabled ? '' : 'disabled'}
            oninput="window.app.setRentQty(${si}, +this.value)">
        </td>`
      : `<td></td><td></td>`;

    rows += `
      <tr>
        <td>Этаж ${f}</td>
        <td>${aptCell}</td>
        ${rentCells}
      </tr>
    `;
  }

  return `
    <div class="floors-table">
      <table>
        <thead>
          <tr>
            <th>Этаж</th>
            <th>Квартир, шт (на корпус)</th>
            <th>Аренда (1-й этаж)</th>
            <th>Количество узлов учета арендных помещений</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// Рендер таблицы зон корпуса
function renderZonesTableForSection(si) {
  const sec = sections[si];
  if (!sec.zones.length) return `<div class="note">Зон пока нет. Добавьте зону корпуса.</div>`;

  const rows = sec.zones.map(z => {
    const d = z.fixedD || { V1: 32, T3: 32, T4: 32 };
    const dis = z.locked ? 'disabled' : '';

    return `
    <tr>
      <td>
        <input type="text" value="${z.name}" ${dis}
          oninput="window.app.updateZone(${si}, ${z.id}, 'name', this.value)"/>
        <div class="inline" style="margin-top:6px;">
          <label class="inline" style="gap:6px;">
            <input type="checkbox" ${z.locked ? 'checked' : ''} onchange="window.app.toggleZoneLock(${si}, ${z.id}, this.checked)">
            Закрепить зону
          </label>
        </div>
      </td>
      <td style="text-align:center;">1</td>
      <td><input type="number" min="1" value="${z.to}" ${dis}
             oninput="window.app.updateZone(${si}, ${z.id}, 'to', +this.value)"/></td>
      <td><input type="number" min="1" value="${z.risers}" ${dis}
             oninput="window.app.updateZone(${si}, ${z.id}, 'risers', +this.value)"/></td>
      <td>${renderDnSelect(d.V1 ?? 32, `window.app.updateZoneDia(${si}, ${z.id}, 'V1', +this.value)`, z.locked)}</td>
      <td>${renderDnSelect(d.T3 ?? 32, `window.app.updateZoneDia(${si}, ${z.id}, 'T3', +this.value)`, z.locked)}</td>
      <td>${renderDnSelect(d.T4 ?? 32, `window.app.updateZoneDia(${si}, ${z.id}, 'T4', +this.value)`, z.locked)}</td>
      <td>
        <select ${dis} onchange="window.app.updateZone(${si}, ${z.id}, 'albumType', this.value)">
          ${albumKeys.map(k => `<option value="${k}" ${z.albumType === k ? 'selected' : ''}>${ALBUMS[k]}</option>`).join('')}
        </select>
      </td>
      <td style="text-align:right;"><button class="btn-danger" onclick="window.app.removeZone(${si}, ${z.id})" ${z.locked ? 'disabled' : ''}>Удалить</button></td>
    </tr>`;
  }).join('');

  return `
    <div class="zone-table">
      <table>
        <thead>
          <tr>
            <th>Название зоны</th>
            <th>Этаж от</th>
            <th>Этаж до</th>
            <th>Стояков, шт (на корпус)</th>
            <th>DN В1</th>
            <th>DN Т3</th>
            <th>DN Т4</th>
            <th>Альбом КУУ</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// Подсчёт количества квартир в корпусе
function getTotalAptsForSection(sec) {
  let total = 0;
  Object.keys(sec.apts).forEach(floor => {
    if (+floor > 1) {
      total += (sec.apts[floor] || 0);
    }
  });
  return total;
}

// Рендер блока расчёта сшитого полиэтилена в МОП для секции
function renderMopBlockForSection(si) {
  const sec = sections[si];
  const mop = sec.mop || { L: 30, r: 0.5 };
  const result = computeMopPexLengthsForSection(sec);

  // Названия положений коллектора
  const positionLabels = {
    0: 'У торца (r = 0)',
    0.5: 'В центре (r = 0.5)',
    1: 'У другого торца (r = 1)'
  };

  return `
    <div class="mop-block">
      <div class="row-2">
        <div class="input-group">
          <label>Длина МОП, L (м):</label>
          <input type="number" min="0" step="0.1" value="${mop.L}"
                 oninput="window.app.setMopLength(${si}, +this.value)">
        </div>
        <div class="input-group">
          <label>Положение коллектора, r:</label>
          <select onchange="window.app.setMopPosition(${si}, +this.value)">
            <option value="0" ${mop.r === 0 ? 'selected' : ''}>У торца (r = 0)</option>
            <option value="0.5" ${mop.r === 0.5 ? 'selected' : ''}>В центре (r = 0.5)</option>
            <option value="1" ${mop.r === 1 ? 'selected' : ''}>У другого торца (r = 1)</option>
          </select>
        </div>
      </div>

      <div class="mop-results">
        <div class="mop-info">
          <span class="mop-label">Квартир в секции:</span>
          <span class="mop-value">${result.n} шт</span>
        </div>
        <div class="mop-result-row">
          <span class="mop-label">Длина труб В1 (корпус):</span>
          <span class="mop-value">${result.lengthV1.toFixed(2)} м</span>
        </div>
        <div class="mop-result-row">
          <span class="mop-label">Длина труб Т3 (корпус):</span>
          <span class="mop-value">${result.lengthT3.toFixed(2)} м</span>
        </div>
      </div>

      <div class="note" style="margin-top: 8px;">
        Расчёт по формуле: m = (d̄ + h) × n, где d̄ — средняя длина до квартиры, h = 1.8 м (опуск), n — кол-во квартир.
      </div>
    </div>
  `;
}

// Рендер карточек корпусов
export function renderSectionsBlocks() {
  const wrap = document.getElementById('sectionsBlocks');
  if (!wrap) return;

  // Сохраняем состояние открытости всех <details> перед ререндером
  const openDetails = new Set();
  wrap.querySelectorAll('details').forEach((det, idx) => {
    if (det.open) {
      openDetails.add(idx);
    }
  });

  const blocks = sections.map((sec, si) => {
    const totalApts = getTotalAptsForSection(sec);
    const aptsLabel = totalApts > 0 ? ` (итого: ${totalApts} кв.)` : '';
    const mopResult = computeMopPexLengthsForSection(sec);
    const mopLabel = mopResult.lengthV1 > 0 ? ` (В1: ${mopResult.lengthV1.toFixed(1)} м, Т3: ${mopResult.lengthT3.toFixed(1)} м)` : '';

    return `
    <div class="sec-card">
      <div class="sec-title">Корпус ${si + 1}</div>

      <div class="row-2">
        <div class="input-group">
          <label>Количество этажей в корпусе:</label>
          <div class="inline">
            <input type="number" min="1" max="200" value="${sec.floors}" ${sec.floorsLocked ? 'disabled' : ''}
                   oninput="window.app.updateSectionFloors(${si}, +this.value)">
            <label class="inline" style="gap:6px;">
              <input type="checkbox" ${sec.floorsLocked ? 'checked' : ''}
                     onchange="window.app.toggleLockFloors(${si}, this.checked)">
              Закрепить
            </label>
          </div>
          <div class="lock-hint">При закреплении поле этажности блокируется и не позволит случайно изменить значение.</div>
        </div>
      </div>

      <details>
        <summary><b>Квартиры по этажам и аренда (только 1-й этаж)${aptsLabel}</b></summary>
        ${renderFloorsTableForSection(si)}
      </details>

      <details>
        <summary><b>Зоны корпуса (начинаются с 1-го этажа)</b></summary>
        ${renderZonesTableForSection(si)}
        <div class="btn-row">
          <button class="btn-secondary" onclick="window.app.addZone(${si})">Добавить зону корпуса</button>
          <button class="btn-danger" onclick="window.app.clearZones(${si})">Очистить зоны корпуса</button>
        </div>
      </details>

      <details>
        <summary><b>Расчёт сшитого полиэтилена в МОП${mopLabel}</b></summary>
        ${renderMopBlockForSection(si)}
      </details>
    </div>
  `;
  }).join('');

  wrap.innerHTML = blocks || `<div class="note">Добавьте хотя бы один корпус.</div>`;

  // Восстанавливаем состояние открытости <details> после ререндера
  wrap.querySelectorAll('details').forEach((det, idx) => {
    if (openDetails.has(idx)) {
      det.open = true;
    }
  });
}

// Рендер шапки таблицы результатов по этажам
export function buildWaterSupplyHead() {
  const thead = document.querySelector('#waterSupplyTable thead');
  if (!thead) return;

  const secCols = sections.map((_, si) => `
    <th>Корпус ${si + 1}: зона (1–to)</th>
    <th>Корпус ${si + 1}: DN (В1/Т3/Т4)</th>
    <th>Корпус ${si + 1}: коллекторы</th>
  `).join('');

  thead.innerHTML = `
    <tr>
      <th>Этаж</th>
      ${secCols}
      <th>Квартир (по зданию)</th>
      <th>Аренда (по зданию)</th>
      <th>Стояков (по зданию)</th>
    </tr>
  `;
}

// Рендер таблицы по этажам
export function renderFloorsTable(floorsData) {
  const tbody = document.querySelector('#waterSupplyTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  floorsData.forEach(row => {
    const tr = tbody.insertRow();
    tr.insertCell(-1).textContent = `Этаж ${row.floor}`;

    row.sectionsInfo.forEach(info => {
      tr.insertCell(-1).textContent = info.zoneCellText;
      tr.insertCell(-1).textContent = info.dnCellText;
      tr.insertCell(-1).textContent = info.collCellText;
    });

    tr.insertCell(-1).textContent = row.aptsTotal;
    tr.insertCell(-1).textContent = row.rentTotal;
    tr.insertCell(-1).textContent = row.risersTotalAtFloor ? row.risersTotalAtFloor : '—';
  });
}

// Рендер предупреждений
export function renderWarnings(warnings) {
  const warnBox = document.getElementById('warnings');
  if (!warnBox) return;

  if (warnings.length) {
    warnBox.style.display = 'block';
    warnBox.innerHTML = `<strong>Предупреждения:</strong><ul>${warnings.map(w => `<li>${w}</li>`).join('')}</ul>`;
  } else {
    warnBox.style.display = 'none';
    warnBox.innerHTML = '';
  }
}

// Рендер сводки по зонам
export function renderZonesSummary(zonesData) {
  const zTbody = document.querySelector('#zonesSummary tbody');
  if (!zTbody) return;
  zTbody.innerHTML = '';

  zonesData.forEach(zd => {
    const tr = zTbody.insertRow();
    tr.insertCell(-1).textContent = `Корпус ${zd.sectionIndex + 1}`;
    tr.insertCell(-1).textContent = zd.zone.name;
    tr.insertCell(-1).textContent = `${zd.from}–${zd.to}`;
    tr.insertCell(-1).textContent = zd.aptsInZone;
    tr.insertCell(-1).textContent = zd.rentInZone;
    tr.insertCell(-1).textContent = zd.risersPerSection;
    tr.insertCell(-1).textContent = zd.d.V1 ? `${zd.d.V1} мм` : '—';
    tr.insertCell(-1).textContent = zd.d.T3 ? `${zd.d.T3} мм` : '—';
    tr.insertCell(-1).textContent = zd.d.T4 ? `${zd.d.T4} мм` : '—';
    tr.insertCell(-1).textContent = zd.hZone.toFixed(2);
    tr.insertCell(-1).textContent = zd.lenOneRiser.toFixed(2);
    tr.insertCell(-1).textContent = zd.lenAllRisers.toFixed(2);
    tr.insertCell(-1).textContent = zd.albumName;
  });
}

// Рендер итогов по стоякам
export function renderRiserTotals(grandTotalRisersLen) {
  const el = document.getElementById('riserTotals');
  if (el) {
    el.textContent = `Итоговая длина стояков по зданию: ${grandTotalRisersLen.toFixed(2)} м`;
  }
}

// Рендер таблицы по системам и диаметрам
export function renderRiserByD(risersByDiameter) {
  const byDTbody = document.querySelector('#riserByD tbody');
  if (!byDTbody) return;
  byDTbody.innerHTML = '';

  risersByDiameter.forEach(item => {
    const row = byDTbody.insertRow();
    row.insertCell(-1).textContent = `Корпус ${item.sectionIndex + 1}`;
    row.insertCell(-1).textContent = `${item.sys} — ${item.dia} мм`;
    row.insertCell(-1).textContent = item.count;
    row.insertCell(-1).textContent = item.len.toFixed(2);
  });
}

// Рендер таблицы альбомов КУУ
export function renderAlbumSummary(byAlbum) {
  const albumBody = document.querySelector('#albumSummary tbody');
  if (!albumBody) return;
  albumBody.innerHTML = '';

  albumKeys.forEach(k => {
    const row = albumBody.insertRow();
    row.insertCell(0).textContent = ALBUMS[k];
    row.insertCell(1).textContent = (byAlbum[k] || 0);
  });
}

// Рендер блока albumDetails с details и таблицами BOM
export function renderAlbumDetails(zonesData) {
  const albumDetailsWrap = document.getElementById('albumDetails');
  if (!albumDetailsWrap) return;

  // Сохраняем состояние открытости всех <details> перед ререндером
  const openDetails = new Set();
  albumDetailsWrap.querySelectorAll('details').forEach((det, idx) => {
    if (det.open) {
      openDetails.add(idx);
    }
  });

  albumDetailsWrap.innerHTML = '';

  zonesData.forEach((zd, idx) => {
    const details = document.createElement('details');
    // Восстанавливаем состояние открытости
    if (openDetails.has(idx)) {
      details.open = true;
    }
    const summary = document.createElement('summary');
    summary.textContent = `Корпус ${zd.sectionIndex + 1} — ${zd.zone.name} — ${zd.albumName} (квартир: ${zd.aptsInZone}; аренда: ${zd.rentInZone}; n=${zd.nAuto})`;
    details.appendChild(summary);

    const holder = document.createElement('div');
    holder.style.marginTop = '8px';

    if (zd.bom.length) {
      const tbl = document.createElement('table');
      tbl.innerHTML = `
        <thead>
          <tr>
            <th>Позиция</th>
            <th>Ед.</th>
            <th>Количество</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tb = tbl.querySelector('tbody');
      zd.bom.forEach(row => {
        const trb = tb.insertRow();
        trb.insertCell(0).textContent = row.name;
        trb.insertCell(1).textContent = row.unit || 'шт';
        trb.insertCell(2).textContent = row.qty.toLocaleString('ru-RU');
      });
      holder.appendChild(tbl);
    } else {
      const p = document.createElement('div');
      p.className = 'note';
      p.textContent = 'Состав для выбранного альбома пока не задан.';
      holder.appendChild(p);
    }

    details.appendChild(holder);
    albumDetailsWrap.appendChild(details);
  });
}

// Рендер блока "Трубопроводы" — сводка по корпусам, системам, диаметрам
export function renderPipelinesBlock(risersByDiameter, zonesData, h1, hn) {
  const container = document.getElementById('pipelinesContent');
  if (!container) return;

  if ((!zonesData || zonesData.length === 0) && (!risersByDiameter || risersByDiameter.length === 0)) {
    container.innerHTML = `
      <div class="placeholder-block">
        <p class="note">Нет данных для отображения. Добавьте зоны в корпусах и выполните расчёт.</p>
      </div>
    `;
    return;
  }

  // Названия систем для отображения
  const sysNames = { V1: 'В1', T3: 'Т3', T4: 'Т4' };

  let html = '';

  // Детализация по зонам с разбивкой по системам
  if (zonesData && zonesData.length > 0) {
    // Группируем по корпусам
    const zonesBySection = new Map();
    zonesData.forEach(zd => {
      if (!zonesBySection.has(zd.sectionIndex)) {
        zonesBySection.set(zd.sectionIndex, []);
      }
      zonesBySection.get(zd.sectionIndex).push(zd);
    });

    const sysNames = { V1: 'В1', T3: 'Т3', T4: 'Т4' };

    zonesBySection.forEach((zones, si) => {
      let sectionTotalLen = 0;

      let tableRows = '';
      zones.forEach(zd => {
        const to = zd.to;

        const systems = ['V1', 'T3', 'T4'];
        const d = zd.d || {};

        systems.forEach((sys, idx) => {
          const dia = d[sys] || 0;
          if (dia > 0) {
            const totalLen = zd.hZone * zd.risersPerSection;
            sectionTotalLen += totalLen;

            // Первая строка системы для зоны - с rowspan для зоны
            const zoneCell = idx === 0
              ? `<td rowspan="3">${zd.zone.name}</td>
                 <td rowspan="3">${zd.from}–${to}</td>`
              : '';

            tableRows += `
              <tr>
                ${zoneCell}
                <td class="sys-cell">${sysNames[sys]}</td>
                <td>${dia}</td>
                <td>${zd.hZone.toFixed(2)}</td>
                <td>${zd.risersPerSection}</td>
                <td>${totalLen.toFixed(2)}</td>
              </tr>
            `;
          }
        });
      });

      html += `
        <div class="pipeline-section">
          <details class="pipeline-details">
            <summary>Корпус ${si + 1} — детализация по зонам (итого: ${sectionTotalLen.toFixed(2)} м.п.)</summary>
            <table class="pipeline-table">
              <thead>
                <tr>
                  <th>Зона</th>
                  <th>Этажи</th>
                  <th>Система</th>
                  <th>Диаметр, мм</th>
                  <th>Длина, м.п.</th>
                  <th>Стояков, шт</th>
                  <th>Всего, м.п.</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
              <tfoot>
                <tr class="total-row">
                  <td colspan="6"><strong>Итого по корпусу ${si + 1}</strong></td>
                  <td><strong>${sectionTotalLen.toFixed(2)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </details>
        </div>
      `;
    });
  }

  // Сводная таблица по всему зданию (суммарно по системам и диаметрам)
  // Собираем данные из zonesData для правильного отображения
  const sysNames2 = { V1: 'В1', T3: 'Т3', T4: 'Т4' };
  const overall = new Map();
  let grandTotal = 0;

  if (zonesData && zonesData.length > 0) {
    zonesData.forEach(zd => {
      const d = zd.d || {};
      ['V1', 'T3', 'T4'].forEach(sys => {
        const dia = d[sys] || 0;
        if (dia > 0) {
          const key = `${sys}:${dia}`;
          const totalLen = zd.hZone * zd.risersPerSection;
          if (!overall.has(key)) {
            overall.set(key, { sys, dia, len: 0, pipeLen: zd.hZone, count: 0 });
          }
          const item = overall.get(key);
          item.len += totalLen;
          item.count += zd.risersPerSection;
          grandTotal += totalLen;
        }
      });
    });
  }

  const overallItems = Array.from(overall.values()).sort((a, b) => {
    const order = { V1: 0, T3: 1, T4: 2 };
    if (order[a.sys] !== order[b.sys]) return order[a.sys] - order[b.sys];
    return a.dia - b.dia;
  });

  html += `
    <div class="pipeline-section pipeline-summary">
      <h4>Сводка по зданию</h4>
      <table class="pipeline-table">
        <thead>
          <tr>
            <th>Система</th>
            <th>Диаметр, мм</th>
            <th>Стояков, шт</th>
            <th>Всего, м.п.</th>
          </tr>
        </thead>
        <tbody>
  `;

  // Группируем сводку по системам
  const overallBySys = { V1: [], T3: [], T4: [] };
  overallItems.forEach(item => {
    if (overallBySys[item.sys]) {
      overallBySys[item.sys].push(item);
    }
  });

  let totalCount = 0;
  ['V1', 'T3', 'T4'].forEach(sys => {
    const sysItems = overallBySys[sys];
    if (sysItems.length === 0) return;

    sysItems.forEach((item, idx) => {
      totalCount += item.count;
      const sysCell = idx === 0
        ? `<td rowspan="${sysItems.length}" class="sys-cell">${sysNames2[sys]}</td>`
        : '';
      html += `
        <tr>
          ${sysCell}
          <td>${item.dia}</td>
          <td>${item.count}</td>
          <td>${item.len.toFixed(2)}</td>
        </tr>
      `;
    });
  });

  html += `
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="2"><strong>Итого по зданию</strong></td>
            <td><strong>${totalCount}</strong></td>
            <td><strong>${grandTotal.toFixed(2)}</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  // Сохраняем состояние открытости всех <details> перед ререндером
  const openDetails = new Set();
  container.querySelectorAll('details').forEach((det, idx) => {
    if (det.open) {
      openDetails.add(idx);
    }
  });

  container.innerHTML = html;

  // Восстанавливаем состояние открытости <details> после ререндера
  container.querySelectorAll('details').forEach((det, idx) => {
    if (openDetails.has(idx)) {
      det.open = true;
    }
  });
}

// Расчёт шага для компенсаторов по диаметру
function getCompensatorStep(dia) {
  if (dia <= 25) return 25; // DN 15-25: каждые 25м
  if (dia <= 40) return 30; // DN 32-40: каждые 30м
  return 35; // DN 50+: каждые 35м
}

// Склонение слова "выход" в зависимости от числа
function getOutletsSuffix(n) {
  const abs = Math.abs(n) % 100;
  const lastDigit = abs % 10;
  if (abs > 10 && abs < 20) return 'ов'; // 11-19 выходов
  if (lastDigit === 1) return '';         // 1 выход
  if (lastDigit >= 2 && lastDigit <= 4) return 'а'; // 2-4 выхода
  return 'ов'; // 5-9, 0 выходов
}

// Расчёт количества компенсаторов
function calcCompensators(length, dia) {
  const step = getCompensatorStep(dia);
  return Math.floor(length / step);
}

// Рендер блока "Арматура"
export function renderFittingsBlock(totalApartments, ivptEnabled, zonesData, totalRentUnits = 0) {
  const container = document.getElementById('fittingsContent');
  if (!container) return;

  let html = '';
  let hasData = false;

  // === Компенсаторы для Т3 и Т4 ===
  // Собираем данные по компенсаторам из zonesData
  const compensators = new Map(); // ключ: "система:диаметр", значение: количество

  if (zonesData && zonesData.length > 0) {
    zonesData.forEach(zd => {
      const d = zd.d || {};
      const risers = zd.risersPerSection || 1;
      const pipeLength = zd.hZone || 0; // длина одного стояка

      // Только для Т3 и Т4
      ['T3', 'T4'].forEach(sys => {
        const dia = d[sys] || 0;
        if (dia > 0 && pipeLength > 0) {
          // Количество компенсаторов на один стояк
          const compPerRiser = calcCompensators(pipeLength, dia);
          // Общее количество компенсаторов для всех стояков зоны
          const totalComp = compPerRiser * risers;

          if (totalComp > 0) {
            const key = `${sys}:${dia}`;
            compensators.set(key, (compensators.get(key) || 0) + totalComp);
          }
        }
      });
    });
  }

  // Отображаем компенсаторы
  if (compensators.size > 0) {
    hasData = true;
    const sysNames = { T3: 'Т3', T4: 'Т4' };

    // Сортируем: сначала по системе, потом по диаметру
    const sortedKeys = Array.from(compensators.keys()).sort((a, b) => {
      const [sysA, diaA] = a.split(':');
      const [sysB, diaB] = b.split(':');
      if (sysA !== sysB) return sysA.localeCompare(sysB);
      return (+diaA) - (+diaB);
    });

    // Считаем общее количество компенсаторов
    let totalCompensators = 0;
    sortedKeys.forEach(key => { totalCompensators += compensators.get(key); });

    html += `
      <div class="fittings-section">
        <details class="fittings-details">
          <summary>Компенсаторы (итого: ${totalCompensators} шт)</summary>
          <table class="pipeline-table">
            <thead>
              <tr>
                <th>Наименование</th>
                <th>Система</th>
                <th>Ед. изм.</th>
                <th>Количество</th>
              </tr>
            </thead>
            <tbody>
    `;

    sortedKeys.forEach(key => {
      const [sys, dia] = key.split(':');
      const count = compensators.get(key);

      html += `
        <tr>
          <td>Компенсатор Ду ${dia}</td>
          <td class="sys-cell">${sysNames[sys]}</td>
          <td>шт</td>
          <td>${count}</td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </details>
      </div>
    `;

    // === Неподвижные опоры (количество компенсаторов × 2) ===
    let totalSupports = 0;
    sortedKeys.forEach(key => { totalSupports += compensators.get(key) * 2; });

    html += `
      <div class="fittings-section">
        <details class="fittings-details">
          <summary>Неподвижные опоры (итого: ${totalSupports} шт)</summary>
          <table class="pipeline-table">
            <thead>
              <tr>
                <th>Наименование</th>
                <th>Система</th>
                <th>Ед. изм.</th>
                <th>Количество</th>
              </tr>
            </thead>
            <tbody>
    `;

    sortedKeys.forEach(key => {
      const [sys, dia] = key.split(':');
      const count = compensators.get(key) * 2; // умножаем на 2

      html += `
        <tr>
          <td>Неподвижная опора Ду ${dia}</td>
          <td class="sys-cell">${sysNames[sys]}</td>
          <td>шт</td>
          <td>${count}</td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </details>
      </div>
    `;
  }

  // === Устройство внутриквартирного пожаротушения ===
  if (ivptEnabled && totalApartments > 0) {
    hasData = true;
    html += `
      <div class="fittings-section">
        <details class="fittings-details">
          <summary>Внутриквартирное пожаротушение (итого: ${totalApartments} кв.)</summary>
          <table class="pipeline-table">
            <thead>
              <tr>
                <th>Наименование</th>
                <th>Ед. изм.</th>
                <th>Количество</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Устройство внутриквартирного пожаротушения</td>
                <td>шт</td>
                <td>${totalApartments}</td>
              </tr>
              <tr>
                <td>Кран шаровый Ду 15 (для ВКП)</td>
                <td>шт</td>
                <td>${totalApartments}</td>
              </tr>
            </tbody>
          </table>
        </details>
      </div>
    `;
  }

  // === Монтаж узла концевого (В1 + Т3) ===
  // Считаем общее количество стояков для В1 и Т3
  let totalRisersV1 = 0;
  let totalRisersT3 = 0;
  if (zonesData && zonesData.length > 0) {
    zonesData.forEach(zd => {
      const d = zd.d || {};
      const risers = zd.risersPerSection || 0;
      if (d.V1 && d.V1 > 0) totalRisersV1 += risers;
      if (d.T3 && d.T3 > 0) totalRisersT3 += risers;
    });
  }

  const totalEndNodeItems = totalRisersV1 + totalRisersT3;
  if (totalEndNodeItems > 0) {
    hasData = true;
    html += `
      <div class="fittings-section">
        <details class="fittings-details">
          <summary>Монтаж узла концевого (итого: ${totalEndNodeItems * 2} шт)</summary>
          <table class="pipeline-table">
            <thead>
              <tr>
                <th>Наименование</th>
                <th>Система</th>
                <th>Ед. изм.</th>
                <th>Количество</th>
              </tr>
            </thead>
            <tbody>
    `;

    // В1
    if (totalRisersV1 > 0) {
      html += `
              <tr>
                <td>Автоматический воздухоотводчик Ду 15</td>
                <td class="sys-cell">В1</td>
                <td>шт</td>
                <td>${totalRisersV1}</td>
              </tr>
              <tr>
                <td>Кран шаровый Ду 15</td>
                <td class="sys-cell">В1</td>
                <td>шт</td>
                <td>${totalRisersV1}</td>
              </tr>
      `;
    }

    // Т3
    if (totalRisersT3 > 0) {
      html += `
              <tr>
                <td>Автоматический воздухоотводчик Ду 15</td>
                <td class="sys-cell">Т3</td>
                <td>шт</td>
                <td>${totalRisersT3}</td>
              </tr>
              <tr>
                <td>Кран шаровый Ду 15</td>
                <td class="sys-cell">Т3</td>
                <td>шт</td>
                <td>${totalRisersT3}</td>
              </tr>
      `;
    }

    html += `
            </tbody>
          </table>
        </details>
      </div>
    `;
  }

  // === Установка счетчика (водомера) ГВС, ХВС ===
  const totalUnits = totalApartments + totalRentUnits;
  if (totalUnits > 0) {
    hasData = true;
    const waterMetersCount = totalUnits * 2; // квартиры + аренда, умноженные на 2

    html += `
      <div class="fittings-section">
        <details class="fittings-details">
          <summary>Установка счетчика (водомера) ГВС, ХВС (итого: ${waterMetersCount} шт)</summary>
          <table class="pipeline-table">
            <thead>
              <tr>
                <th>Наименование</th>
                <th>Ед. изм.</th>
                <th>Количество</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Счетчик воды</td>
                <td>шт</td>
                <td>${waterMetersCount}</td>
              </tr>
            </tbody>
          </table>
        </details>
      </div>
    `;
  }

  // === Распределительный этажный коллектор ===
  const collectorsByOutlets = new Map(); // ключ: количество выходов, значение: количество коллекторов

  // Обрабатываем каждый корпус
  sections.forEach((sec, si) => {
    if (!sec.zones || sec.zones.length === 0) return;

    // Находим максимальный этаж с данными (на случай если apts содержит этажи выше floors)
    const aptsFloors = Object.keys(sec.apts).map(k => parseInt(k, 10)).filter(k => k > 0 && sec.apts[k] > 0);
    const maxFloor = Math.max(sec.floors || 0, ...aptsFloors);

    // Проходим по всем этажам корпуса (со 2-го, т.к. 1-й - аренда)
    for (let floor = 2; floor <= maxFloor; floor++) {
      const aptsOnFloor = sec.apts[floor] || 0;
      if (aptsOnFloor <= 0) continue;

      // Находим зону, которая покрывает этот этаж
      const zone = sectionZoneForFloor(sec, floor);
      if (!zone) continue;

      const risers = Math.max(1, +zone.risers || 1);

      // Распределяем квартиры по стоякам (коллекторам)
      // Каждый стояк обслуживает несколько квартир, каждая квартира = 1 коллектор
      // Например: 6 квартир на 2 стояка = 3+3 (два коллектора по 3 выхода)
      const base = Math.floor(aptsOnFloor / risers);
      const rem = aptsOnFloor % risers;

      for (let i = 0; i < risers; i++) {
        // Первые rem стояков получают base+1 квартир, остальные - base
        const outlets = i < rem ? base + 1 : base;
        // Пропускаем стояки без квартир (когда квартир меньше, чем стояков)
        if (outlets <= 0) continue;
        // Минимум 2 выхода, т.к. коллектор на 1 выход не существует
        const actualOutlets = Math.max(2, outlets);

        collectorsByOutlets.set(actualOutlets, (collectorsByOutlets.get(actualOutlets) || 0) + 1);
      }
    }
  });

  if (collectorsByOutlets.size > 0) {
    hasData = true;

    // Считаем общее количество коллекторов
    let totalCollectors = 0;
    collectorsByOutlets.forEach(count => { totalCollectors += count; });

    // Сортируем по количеству выходов
    const sortedOutlets = Array.from(collectorsByOutlets.keys()).sort((a, b) => a - b);

    html += `
      <div class="fittings-section">
        <details class="fittings-details">
          <summary>Распределительный этажный коллектор (итого: ${totalCollectors} шт)</summary>
          <table class="pipeline-table">
            <thead>
              <tr>
                <th>Наименование</th>
                <th>Ед. изм.</th>
                <th>Количество</th>
              </tr>
            </thead>
            <tbody>
    `;

    sortedOutlets.forEach(outlets => {
      const count = collectorsByOutlets.get(outlets);
      html += `
              <tr>
                <td>Коллектор на ${outlets} выход${getOutletsSuffix(outlets)}</td>
                <td>шт</td>
                <td>${count}</td>
              </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </details>
      </div>
    `;
  }

  // Если нет данных
  if (!hasData) {
    html += `
      <div class="placeholder-block">
        <p class="note">Нет данных для отображения. Добавьте зоны в корпусах и выполните расчёт.</p>
      </div>
    `;
  }

  // Сохраняем состояние открытости всех <details> перед ререндером
  const openDetails = new Set();
  container.querySelectorAll('details').forEach((det, idx) => {
    if (det.open) {
      openDetails.add(idx);
    }
  });

  container.innerHTML = html;

  // Восстанавливаем состояние открытости <details> после ререндера
  container.querySelectorAll('details').forEach((det, idx) => {
    if (openDetails.has(idx)) {
      det.open = true;
    }
  });
}

// Склонение слова "выход" в зависимости от числа (для сводки по коллекторам)
function getOutletsSuffixForSummary(n) {
  const abs = Math.abs(n) % 100;
  const lastDigit = abs % 10;
  if (abs > 10 && abs < 20) return 'ов'; // 11-19 выходов
  if (lastDigit === 1) return '';         // 1 выход
  if (lastDigit >= 2 && lastDigit <= 4) return 'а'; // 2-4 выхода
  return 'ов'; // 5-9, 0 выходов
}

// Рендер сводки по коллекторам (по корпусам)
export function renderCollectorsSummary(zonesData) {
  const container = document.getElementById('collectorsSummary');
  if (!container) return;

  if (!sections || sections.length === 0) {
    container.innerHTML = `
      <div class="placeholder-block">
        <p class="note">Нет данных для отображения. Добавьте корпуса и зоны.</p>
      </div>
    `;
    return;
  }

  // Сохраняем состояние открытости <details> перед ререндером
  const openDetails = new Set();
  container.querySelectorAll('details').forEach((det, idx) => {
    if (det.open) {
      openDetails.add(idx);
    }
  });

  let html = '';

  // Общая сводка по всему зданию
  const totalByOutlets = new Map(); // ключ: количество выходов, значение: количество коллекторов

  // Обрабатываем каждый корпус
  sections.forEach((sec, si) => {
    if (!sec.zones || sec.zones.length === 0) return;

    // Коллекторы для этого корпуса
    const collectorsByOutlets = new Map(); // ключ: количество выходов, значение: количество коллекторов

    // Находим максимальный этаж с данными (на случай если apts содержит этажи выше floors)
    const aptsFloors = Object.keys(sec.apts).map(k => parseInt(k, 10)).filter(k => k > 0 && sec.apts[k] > 0);
    const maxFloor = Math.max(sec.floors || 0, ...aptsFloors);

    // Проходим по всем этажам корпуса (со 2-го, т.к. 1-й - аренда)
    for (let floor = 2; floor <= maxFloor; floor++) {
      const aptsOnFloor = sec.apts[floor] || 0;
      if (aptsOnFloor <= 0) continue;

      // Находим зону, которая покрывает этот этаж
      const zone = sectionZoneForFloor(sec, floor);
      if (!zone) continue;

      const risers = Math.max(1, +zone.risers || 1);

      // Распределяем квартиры по стоякам (коллекторам)
      // Каждый стояк обслуживает несколько квартир, каждая квартира = 1 коллектор
      // Например: 6 квартир на 2 стояка = 3+3 (два коллектора по 3 выхода)
      const base = Math.floor(aptsOnFloor / risers);
      const rem = aptsOnFloor % risers;

      for (let i = 0; i < risers; i++) {
        // Первые rem стояков получают base+1 квартир, остальные - base
        const outlets = i < rem ? base + 1 : base;
        // Пропускаем стояки без квартир (когда квартир меньше, чем стояков)
        if (outlets <= 0) continue;
        // Минимум 2 выхода, т.к. коллектор на 1 выход не существует
        const actualOutlets = Math.max(2, outlets);

        collectorsByOutlets.set(actualOutlets, (collectorsByOutlets.get(actualOutlets) || 0) + 1);
        totalByOutlets.set(actualOutlets, (totalByOutlets.get(actualOutlets) || 0) + 1);
      }
    }

    // Если для корпуса есть коллекторы
    if (collectorsByOutlets.size > 0) {
      // Считаем общее количество коллекторов для корпуса
      let sectionTotal = 0;
      collectorsByOutlets.forEach(count => { sectionTotal += count; });

      // Сортируем по количеству выходов
      const sortedOutlets = Array.from(collectorsByOutlets.keys()).sort((a, b) => a - b);

      html += `
        <details class="collector-details">
          <summary><b>Корпус ${si + 1}</b> (итого: ${sectionTotal} шт)</summary>
          <table class="pipeline-table">
            <thead>
              <tr>
                <th>Тип коллектора</th>
                <th>Количество, шт</th>
              </tr>
            </thead>
            <tbody>
      `;

      sortedOutlets.forEach(outlets => {
        const count = collectorsByOutlets.get(outlets);
        html += `
              <tr>
                <td>Коллектор на ${outlets} выход${getOutletsSuffixForSummary(outlets)}</td>
                <td>${count}</td>
              </tr>
        `;
      });

      html += `
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td><strong>Итого по корпусу ${si + 1}</strong></td>
                <td><strong>${sectionTotal}</strong></td>
              </tr>
            </tfoot>
          </table>
        </details>
      `;
    }
  });

  // Общая сводка по зданию
  if (totalByOutlets.size > 0) {
    let grandTotal = 0;
    totalByOutlets.forEach(count => { grandTotal += count; });

    const sortedTotalOutlets = Array.from(totalByOutlets.keys()).sort((a, b) => a - b);

    html += `
      <div class="pipeline-section pipeline-summary" style="margin-top: 16px;">
        <h4>Сводка по зданию</h4>
        <table class="pipeline-table">
          <thead>
            <tr>
              <th>Тип коллектора</th>
              <th>Количество, шт</th>
            </tr>
          </thead>
          <tbody>
    `;

    sortedTotalOutlets.forEach(outlets => {
      const count = totalByOutlets.get(outlets);
      html += `
            <tr>
              <td>Коллектор на ${outlets} выход${getOutletsSuffixForSummary(outlets)}</td>
              <td>${count}</td>
            </tr>
      `;
    });

    html += `
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td><strong>Итого по зданию</strong></td>
              <td><strong>${grandTotal}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  if (!html) {
    html = `
      <div class="placeholder-block">
        <p class="note">Нет данных для отображения. Убедитесь, что указано количество квартир по этажам.</p>
      </div>
    `;
  }

  container.innerHTML = html;

  // Восстанавливаем состояние открытости <details> после ререндера
  container.querySelectorAll('details').forEach((det, idx) => {
    if (openDetails.has(idx)) {
      det.open = true;
    }
  });
}
