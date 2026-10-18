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
    },

    /**
     * Virtual Scroller for efficiently rendering large lists
     * Only renders visible items in the viewport
     */
    VirtualScroller: class {
        constructor(container, itemHeight, options = {}) {
            this.container = container;
            this.itemHeight = itemHeight;
            this.options = {
                buffer: 5, // Number of extra items to render above/below viewport
                ...options
            };
            
            this.items = [];
            this.visibleStart = 0;
            this.visibleEnd = 0;
            this.scrollListener = null;
            this.resizeListener = null;
            
            // Heights measured per rendered item (real heights allow variable-height cards)
            this._measuredHeights = new Map();

            // Create the scrolling structure
            this._createStructure();

            // Allow the scroll area to have a fixed height (required when the
            // contentContainer is absolutely positioned and the page already scrolls)
            if (this.options.height) {
                this.scrollContainer.style.height = this.options.height;
            }
            
            // Bind event listeners
            this._bindEvents();
        }
        
        _createStructure() {
            // Clear container
            this.container.innerHTML = '';
            
            // Create scroll container
            this.scrollContainer = document.createElement('div');
            this.scrollContainer.style.cssText = `
                position: relative;
                overflow-y: auto;
                will-change: transform;
            `;
            
            // Create content container (will be sized to total height)
            this.contentContainer = document.createElement('div');
            this.contentContainer.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
            `;
            
            // Create placeholder for empty state
            this.placeholder = document.createElement('div');
            this.placeholder.style.cssText = `
                padding: 20px;
                text-align: center;
                color: #666;
            `;
            this.contentContainer.appendChild(this.placeholder);
            
            // Build the structure
            this.scrollContainer.appendChild(this.contentContainer);
            this.container.appendChild(this.scrollContainer);
        }
        
        _bindEvents() {
            this.scrollListener = () => this._onScroll();
            this.resizeListener = () => this._onResize();
            
            this.scrollContainer.addEventListener('scroll', this.scrollListener);
            window.addEventListener('resize', this.resizeListener);
        }
        
        _unbindEvents() {
            if (this.scrollListener) {
                this.scrollContainer.removeEventListener('scroll', this.scrollListener);
            }
            if (this.resizeListener) {
                window.removeEventListener('resize', this.resizeListener);
            }
        }
        
        _onScroll() {
            this._updateVisibleItems();
        }
        
        _onResize() {
            // Update visible items on resize as item height or viewport may change
            this._updateVisibleItems();
        }
        
        _getViewportInfo() {
            const containerRect = this.scrollContainer.getBoundingClientRect();
            const viewportHeight = containerRect.height;
            
            const scrollTop = this.scrollContainer.scrollTop;
            
            const startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.options.buffer);
            const endIndex = Math.min(
                this.items.length,
                Math.ceil((scrollTop + viewportHeight) / this.itemHeight) + this.options.buffer
            );
            
            return { startIndex, endIndex, viewportHeight, scrollTop };
        }
        
        _getOffsetTop(index) {
            let top = 0;
            const limit = Math.min(index, this.items.length);
            for (let i = 0; i < limit; i++) {
                top += this._measuredHeights.get(i) != null ? this._measuredHeights.get(i) : this.itemHeight;
            }
            return top;
        }

        _getTotalHeight() {
            let total = 0;
            for (let i = 0; i < this.items.length; i++) {
                total += this._measuredHeights.get(i) != null ? this._measuredHeights.get(i) : this.itemHeight;
            }
            return total;
        }

        _updateVisibleItems() {
            if (this.items.length === 0) {
                this.placeholder.style.display = 'block';
                return;
            }

            const { startIndex, endIndex } = this._getViewportInfo();

            // Only update if the visible range has changed significantly
            if (startIndex === this.visibleStart && endIndex === this.visibleEnd) {
                return;
            }

            this.visibleStart = startIndex;
            this.visibleEnd = endIndex;

            // Render visible items
            const fragment = document.createDocumentFragment();
            const rendered = [];

            for (let i = startIndex; i < endIndex; i++) {
                const itemElement = this.options.renderItem(this.items[i], i);
                if (itemElement) {
                    // Position the item at its measured offset (supports variable heights)
                    itemElement.style.position = 'absolute';
                    itemElement.style.top = `${this._getOffsetTop(i)}px`;
                    itemElement.style.left = '0';
                    itemElement.style.width = '100%';
                    itemElement.style.boxSizing = 'border-box';
                    rendered.push({ index: i, el: itemElement });
                    fragment.appendChild(itemElement);
                }
            }

            // Update content container height (sum of measured/estimated heights)
            this.contentContainer.style.height = `${this._getTotalHeight()}px`;

            // Clear and append new items
            this.contentContainer.innerHTML = '';
            this.contentContainer.appendChild(fragment);

            // Measure real heights after insertion so subsequent scroll positions are
            // accurate, even with variable-height cards.
            for (const { index, el } of rendered) {
                const h = el.offsetHeight;
                if (h > 0) this._measuredHeights.set(index, h);
            }

            // Reposition rendered items using the freshly measured heights so that the
            // first paint (done with estimated offsets) does not leave cards overlapping.
            for (const { index, el } of rendered) {
                el.style.top = `${this._getOffsetTop(index)}px`;
            }
            this.contentContainer.style.height = `${this._getTotalHeight()}px`;

            // Hide placeholder if we have items
            this.placeholder.style.display = this.items.length === 0 ? 'block' : 'none';
        }
        
        /**
         * Set the items to display
         * @param {Array} items - Array of data items
         */
        setItems(items) {
            this.items = items;
            this.visibleStart = 0;
            this.visibleEnd = 0;
            this._updateVisibleItems();
        }
        
        /**
         * Get the current visible items range
         * @returns {{start: number, end: number}}
         */
        getVisibleRange() {
            return { start: this.visibleStart, end: this.visibleEnd };
        }
        
        /**
         * Destroy the virtual scroller and clean up listeners
         */
        destroy() {
            this._unbindEvents();
            this.container.innerHTML = '';
        }
    },

    /**
     * Progress Indicator for long operations
     * Shows detailed progress with percentage, time elapsed, and ETA
     */
    Progress: class {
        constructor(container, options = {}) {
            this.container = container;
            this.options = {
                showPercentage: true,
                showTime: true,
                showETA: true,
                minWidth: 280,
                ...options
            };
            
            this.startTime = null;
            this.lastUpdateTime = null;
            this.percent = 0;
            this.statusText = '';
            this.isIndeterminate = false;
            this.timerInterval = null;
            
            // Create the progress structure
            this._createStructure();
        }
        
        _createStructure() {
            // Clear container
            this.container.innerHTML = '';
            
            // Create progress container
            this.progressContainer = document.createElement('div');
            this.progressContainer.style.cssText = `
                text-align: center;
                padding: 20px;
                min-width: ${this.options.minWidth}px;
                box-sizing: border-box;
            `;
            
            // Title
            this.titleElement = document.createElement('div');
            this.titleElement.style.cssText = `
                font-weight: 800;
                font-size: 1.1rem;
                margin-bottom: 8px;
            `;
            this.progressContainer.appendChild(this.titleElement);
            
            // Description
            this.descriptionElement = document.createElement('div');
            this.descriptionElement.style.cssText = `
                font-size: 0.85rem;
                color: var(--text-s);
                margin-bottom: 20px;
                min-height: 1.2em;
            `;
            this.progressContainer.appendChild(this.descriptionElement);
            
            // Progress bar container
            this.barContainer = document.createElement('div');
            this.barContainer.style.cssText = `
                width: 100%;
                height: 6px;
                background: rgba(255,255,255,0.1);
                border-radius: var(--r-sm);
                overflow: hidden;
                position: relative;
                margin-bottom: 8px;
            `;
            
            // Progress bar fill
            this.barFill = document.createElement('div');
            this.barFill.style.cssText = `
                position: absolute;
                left: 0;
                top: 0;
                height: 100%;
                width: 0%;
                background: #c9851f;
                transition: width 0.4s ease;
                border-radius: var(--r-sm);
            `;
            this.barContainer.appendChild(this.barFill);
            this.progressContainer.appendChild(this.barContainer);
            
            // Percentage text
            if (this.options.showPercentage) {
                this.percentElement = document.createElement('div');
                this.percentElement.style.cssText = `
                    font-size: 0.85rem;
                    color: var(--text-s);
                    margin-bottom: 4px;
                    font-weight: 700;
                `;
                this.progressContainer.appendChild(this.percentElement);
            }
            
            // Status text (time elapsed, ETA)
            if (this.options.showTime || this.options.showETA) {
                this.statusElement = document.createElement('div');
                this.statusElement.style.cssText = `
                    font-size: 0.7rem;
                    color: var(--text-s);
                    margin-top: 4px;
                    font-weight: 700;
                    min-height: 1em;
                `;
                this.progressContainer.appendChild(this.statusElement);
            }
            
            // Indeterminate spinner (for when we don't know progress)
            this.indeterminateElement = document.createElement('div');
            this.indeterminateElement.style.cssText = `
                display: none;
                width: 24px;
                height: 24px;
                border: 2px solid var(--text-s);
                border-top-color: transparent;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 20px auto;
            `;
            this.progressContainer.appendChild(this.indeterminateElement);
            
            // Add the container to our main container
            this.container.appendChild(this.progressContainer);
        }
        
        /**
         * Start the progress indicator
         * @param {string} title - Title to display
         * @param {string} description - Description to display
         * @param {boolean} indeterminate - Whether progress is indeterminate
         */
        start(title = 'Procesando...', description = '', indeterminate = false) {
            this.titleElement.textContent = title;
            this.descriptionElement.textContent = description;
            this.isIndeterminate = indeterminate;
            this.percent = 0;
            this.startTime = Date.now();
            this.lastUpdateTime = this.startTime;
            
            // Update UI
            if (this.percentElement) {
                this.percentElement.textContent = '0%';
            }
            if (this.barFill) {
                this.barFill.style.width = '0%';
            }
            if (this.statusElement) {
                this.statusElement.textContent = '';
            }
            
            // Show/hide elements based on mode
            const barContainer = this.barContainer;
            const percentElement = this.percentElement;
            const statusElement = this.statusElement;
            const indeterminateElement = this.indeterminateElement;
            
            if (barContainer) barContainer.style.display = indeterminate ? 'none' : 'block';
            if (percentElement) percentElement.style.display = indeterminate ? 'none' : 'block';
            if (statusElement) statusElement.style.display = (!indeterminate && (this.options.showTime || this.options.showETA)) ? 'block' : 'none';
            if (indeterminateElement) indeterminateElement.style.display = indeterminate ? 'block' : 'none';
            
            // Start timer for updating time display
            if (this.options.showTime || this.options.showETA) {
                this._startTimer();
            }
        }
        
        /**
         * Update the progress
         * @param {number} percent - Progress percentage (0-100)
         * @param {string} statusText - Optional status text to display
         */
        update(percent, statusText = '') {
            this.percent = Math.max(0, Math.min(100, percent));
            this.statusText = statusText;
            this.lastUpdateTime = Date.now();
            
            // Update UI
            if (!this.isIndeterminate) {
                if (this.percentElement) {
                    this.percentElement.textContent = `${Math.round(this.percent)}%`;
                }
                if (this.barFill) {
                    this.barFill.style.width = `${this.percent}%`;
                }
                if (this.statusElement && statusText) {
                    this.statusElement.textContent = statusText;
                }
            }
        }
        
        /**
         * Set indeterminate mode
         * @param {boolean} indeterminate - Whether to show indeterminate progress
         */
        setIndeterminate(indeterminate = true) {
            this.isIndeterminate = indeterminate;
            
            // Show/hide elements based on mode
            const barContainer = this.barContainer;
            const percentElement = this.percentElement;
            const statusElement = this.statusElement;
            const indeterminateElement = this.indeterminateElement;
            
            if (barContainer) barContainer.style.display = indeterminate ? 'none' : 'block';
            if (percentElement) percentElement.style.display = indeterminate ? 'none' : 'block';
            if (statusElement) statusElement.style.display = (!indeterminate && (this.options.showTime || this.options.showETA)) ? 'block' : 'none';
            if (indeterminateElement) indeterminateElement.style.display = indeterminate ? 'block' : 'none';
            
            if (indeterminate) {
                // Stop timer when in indeterminate mode
                this._stopTimer();
            } else if (this.options.showTime || this.options.showETA) {
                // Start timer when switching to determinate mode
                this._startTimer();
            }
        }
        
        /**
         * Complete the progress indicator
         * @param {string} finalText - Final text to show when complete
         */
        complete(finalText = 'Completado') {
            this.percent = 100;
            this.isIndeterminate = false;
            this.lastUpdateTime = Date.now();
            
            // Update UI to show completion
            if (this.percentElement) {
                this.percentElement.textContent = '100%';
            }
            if (this.barFill) {
                this.barFill.style.width = '100%';
            }
            if (this.statusElement) {
                this.statusElement.textContent = finalText;
            }
            
            // Show determinate elements
            const barContainer = this.barContainer;
            const percentElement = this.percentElement;
            const statusElement = this.statusElement;
            const indeterminateElement = this.indeterminateElement;
            
            if (barContainer) barContainer.style.display = 'block';
            if (percentElement) percentElement.style.display = 'block';
            if (statusElement) statusElement.style.display = (this.options.showTime || this.options.showETA) ? 'block' : 'none';
            if (indeterminateElement) indeterminateElement.style.display = 'none';
            
            // Stop timer
            this._stopTimer();
        }
        
        /**
         * Start the timer for updating time display
         */
        _startTimer() {
            this._stopTimer(); // Clear any existing timer
            this.timerInterval = setInterval(() => {
                this._updateTimeDisplay();
            }, 1000); // Update every second
        }
        
        /**
         * Stop the timer
         */
        _stopTimer() {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
        }
        
        /**
         * Update the time elapsed and ETA display
         */
        _updateTimeDisplay() {
            if (!this.startTime) return;
            
            const now = Date.now();
            const elapsedMs = now - this.startTime;
            const elapsedSeconds = Math.floor(elapsedMs / 1000);
            
            let timeText = '';
            
            // Format elapsed time
            const hours = Math.floor(elapsedSeconds / 3600);
            const minutes = Math.floor((elapsedSeconds % 3600) / 60);
            const seconds = elapsedSeconds % 60;
            
            if (hours > 0) {
                timeText += `${hours}h ${minutes}m ${seconds}s`;
            } else if (minutes > 0) {
                timeText += `${minutes}m ${seconds}s`;
            } else {
                timeText += `${seconds}s`;
            }
            
            // Calculate ETA if we have progress percentage
            if (this.options.showETA && !this.isIndeterminate && this.percent > 0 && this.percent < 100) {
                const elapsed = now - this.startTime;
                const estimatedTotal = elapsed / (this.percent / 100);
                const remainingMs = estimatedTotal - elapsed;
                
                if (remainingMs > 0) {
                    const remainingSeconds = Math.floor(remainingMs / 1000);
                    const remainingHours = Math.floor(remainingSeconds / 3600);
                    const remainingMinutes = Math.floor((remainingSeconds % 3600) / 60);
                    const remainingSecs = remainingSeconds % 60;
                    
                    let etaText = '';
                    if (remainingHours > 0) {
                        etaText += `${remainingHours}h ${remainingMinutes}m ${remainingSecs}s`;
                    } else if (remainingMinutes > 0) {
                        etaText += `${remainingMinutes}m ${remainingSecs}s`;
                    } else {
                        etaText += `${remainingSecs}s`;
                    }
                    
                    timeText += ` - ETA: ${etaText}`;
                }
            }
            
            if (this.statusElement) {
                if (this.options.showTime && !this.options.showETA) {
                    this.statusElement.textContent = `Transcurrido: ${timeText}`;
                } else if (!this.options.showTime && this.options.showETA) {
                    this.statusElement.textContent = timeText; // Just ETA
                } else {
                    this.statusElement.textContent = `Transcurrido: ${timeText}`;
                }
            }
        }
        
        /**
         * Destroy the progress indicator and clean up
         */
        destroy() {
            this._stopTimer();
            this.container.innerHTML = '';
        }
    }
};

window.UI = UI;
