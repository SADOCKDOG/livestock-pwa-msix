/**
 * Livestock Manager - UI Utilities v1.0.0
 * Funciones centralizadas de formato y renderizado compartido.
 */

const UI = {
    formatCurrency(value, opts) {
        const n = Number(value) || 0;
        const decimals = opts?.decimals ?? 2;
        return n.toLocaleString('es-ES', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }) + ' €';
    },

    formatCurrencyCompact(value) {
        const n = Number(value) || 0;
        if (Math.abs(n) >= 1000) {
            return (n / 1000).toFixed(1).replace('.', ',') + 'k €';
        }
        return UI.formatCurrency(n, { decimals: 0 });
    },

    formatUnitPrice(value, unit, decimals) {
        const n = Number(value) || 0;
        const d = decimals ?? 2;
        return n.toLocaleString('es-ES', {
            minimumFractionDigits: d,
            maximumFractionDigits: d
        }) + ' €/' + (unit || 'ud');
    },

    formatDate(dateStr) {
        if (!dateStr) return '—';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        } catch (e) {
            return dateStr;
        }
    },

    formatNumber(value, decimals) {
        const n = Number(value) || 0;
        const d = decimals ?? 0;
        return n.toLocaleString('es-ES', {
            minimumFractionDigits: d,
            maximumFractionDigits: d
        });
    },

    formatPercent(value, decimals) {
        const n = Number(value) || 0;
        const d = decimals ?? 1;
        return n.toLocaleString('es-ES', {
            minimumFractionDigits: d,
            maximumFractionDigits: d
        }) + '%';
    },

    formatWeight(value, decimals) {
        const n = Number(value) || 0;
        const d = decimals ?? 0;
        return n.toLocaleString('es-ES', {
            minimumFractionDigits: d,
            maximumFractionDigits: d
        }) + ' kg';
    },

    nullDisplay(value) {
        if (value === null || value === undefined || value === '' || value === 0) return '—';
        return value;
    },

    renderEmptyState(opts) {
        const { icon, title, description, ctaLabel, ctaAction } = opts || {};
        const iconHtml = icon ? `<div class="empty-state-icon">${icon}</div>` : '';
        const titleHtml = title ? `<div class="empty-state-title">${title}</div>` : '';
        const descHtml = description ? `<div class="empty-state-text">${description}</div>` : '';
        const ctaHtml = ctaLabel && ctaAction
            ? `<button class="btn btn-primary mt-12" onclick="${ctaAction}">${ctaLabel}</button>`
            : '';
        return `<div class="empty-state">${iconHtml}${titleHtml}${descHtml}${ctaHtml}</div>`;
    }
};

window.UI = UI;
