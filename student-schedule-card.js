// == STUDENT SCHEDULE CARD + EDITOR ==
(function (LitElement) {
    const html = LitElement.prototype.html;
    const css = LitElement.prototype.css;
    // MARK: Card Component
    class StudentScheduleCard extends LitElement {
        static get properties() {
            return {
                hass: {},
                config: {},
            };
        }

        setConfig(config) {
            if (!config.times || !config.subjects || !config.days) {
                throw new Error("You must define 'days', 'times', and 'subjects'.");
            }
            this.config = {
                show_highlight: true,
                show_rooms: true,
                shorten_room_names: true,
                ...structuredClone(config),
            };
        }

        getCardSize() {
            return (this.config.times?.length || 0) + 1;
        }

        render() {
            const times = this.config.times;
            const subjects = this.config.subjects;
            const breaks = this.config.show_breaks ? this.config.breaks || [] : [];
            const breakLabel = this.config.break_label || "Pause";
            const containerWidth = this.offsetWidth;
            const useShortDays = containerWidth < 700; // Schwelle anpassen
            const useShortSubjects = containerWidth < 700; // Schwelle anpassen
            const defaultPlaceholder = this.config.default_placeholder;
            const showHighlight = this.config.show_highlight !== false;
            const showRooms = this.config.show_rooms !== false;
            const shortenRooms = useShortSubjects && this.config.shorten_room_names !== false;
            const days = useShortDays
                ? this._shortenDays(this.config.days)
                : this.config.days;
            const useShortTime = days.length > 5 && containerWidth < 700; // Schwelle anpassen
            const displayBreak = useShortDays
                ? this._shortenSubject(breakLabel)
                : breakLabel;
            const allTimes = [
                ...times.map((t) => ({ type: "lesson", time: t })),
                ...breaks.map((b) => ({ type: "break", time: b })),
            ].sort(
                (a, b) =>
                    this._toMinutes(a.time.split("-")[0]) -
                    this._toMinutes(b.time.split("-")[0])
            );

            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const currentDayIndex = now.getDay(); // 0=So ... 6=Sa
            const dayOffset = 1; // 1 = Woche startet mit Montag
            const currentDayLabel = days[(currentDayIndex + 7 - dayOffset) % 7];

            return html`
        <ha-card
          header=${this._renderHeader()}
          style="padding-bottom: 24px; width: 100%;"
        >
          <table class="stundenplan">
            <tr>
              <th></th>
             ${days.map((day) => {
                const highlightClass = showHighlight && day === currentDayLabel ? "highlight" : "";
                return html`<th id="tag-${day}" class="${highlightClass}">${day}</th>`;
            })}
            </tr>
            ${allTimes.map((row) => {
                const [start, end] = row.time.split("-").map((t) => t.trim());
                const startMin = this._toMinutes(start);
                const endMin = this._toMinutes(end);
                const isNow =
                    currentMinutes >= startMin && currentMinutes < endMin;
                const rowClass =
                    row.type === "break"
                        ? "pause"
                        : showHighlight && isNow
                            ? "active-row"
                            : "";


                return html`
                <tr class="${rowClass}">
                  <td>
                    <b
                      >${useShortTime
                        ? row.time.split("-")[0].trim()
                        : row.time}</b
                    >
                  </td>
                  ${days.map((_, dayIdx) => {
                            const tagClass =
                                showHighlight && dayIdx === currentDayIndex - 1
                                    ? "highlight-col-cell"
                                    : "";
                            if (row.type === "break")
                                return html`<td class="pause ${tagClass}">
                        ${displayBreak}
                      </td>`;

                            const index = times.findIndex((t) => t.trim() === row.time);
                            const dayKey = (dayIdx + 1).toString();
                            const raw = subjects?.[dayKey]?.[index];
                            let subject = defaultPlaceholder;
                            let room = null;
                            let isFree = false;

                            if (typeof raw === "object" && raw !== null) {
                                isFree = raw.free === true;
                                subject = isFree ? defaultPlaceholder : raw.subject || defaultPlaceholder;
                                room = isFree ? null : raw.room || null;
                            } else if (typeof raw === "string") {
                                subject = raw;
                            }
                            const baseColor = this.config.colors?.[isFree ? "FREE" : subject] || "#ccc";

                            const displayName = useShortSubjects
                                ? this._shortenSubject(subject)
                                : subject;
                            const tooltip = room
                                ? `${subject} – Raum ${room}`
                                : subject;

                            return html`
                      <td
                        class="${tagClass}"
                        style="background-color:${this._withAlpha(
                                baseColor
                            )}; text-align:center"
                      >
                        <div title="${tooltip}">
                          <div>${displayName}</div>
                          ${room && showRooms
                                    ? html`<div class="room">${shortenRooms ? this._shortenSubject(room) : room}</div>`
                                    : ""}
                        </div>
                      </td>
                    `;
                        })}
                </tr>
              `;
            })}
          </table>
        </ha-card>
      `;
        }
        _shortenDays(days) {
            return days.map((d) =>
                d.length > 3
                    ? d.slice(0, 2) // z. B. „Montag“ → „Mo“
                    : d
            );
        }
        _shortenSubject(name) {
            if (!name || name.length <= 2) return name;
            return name.slice(0, 2); // z. B. "Mathematik" → "Ma"
        }
        connectedCallback() {
            super.connectedCallback();
            this._resizeObserver = new ResizeObserver(() => this.requestUpdate());
            this._resizeObserver.observe(this);
        }

        disconnectedCallback() {
            this._resizeObserver.disconnect();
            super.disconnectedCallback();
        }

        _toMinutes(t) {
            const [h, m] = t.split(":").map(Number);
            return h * 60 + m;
        }
        _renderHeader() {
            const { person_entity, name, icon, description } = this.config;

            if (person_entity && this.hass?.states[person_entity]) {
                const entity = this.hass.states[person_entity];
                const entityName = entity.attributes.friendly_name || person_entity;
                const entityIcon = entity.attributes.icon || "mdi:account";
                const avatar = entity.attributes.entity_picture;

                return html`
          <div style="text-align: center;">
            <span
              style="display: flex; align-items: center; justify-content: center; gap: 8px;"
            >
              ${avatar
                        ? html`<img
                    src="${avatar}"
                    style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;"
                    alt="avatar"
                  />`
                        : html`<ha-icon icon="${entityIcon}"></ha-icon>`}
              <span>${entityName}</span>
            </span>
            ${description
                        ? html`<div
                  style="margin-top: 4px; font-size: 0.85em; color: var(--secondary-text-color);"
                >
                  ${description}
                </div>`
                        : ""}
          </div>
        `;
            }

            return html`
        <div style="text-align: center;">
          <span
            style="display: flex; align-items: center; justify-content: center; gap: 8px;"
          >
            ${icon ? html`<ha-icon icon="${icon}"></ha-icon>` : ""}
            <span>${name || "Student Schedule"}</span>
          </span>
          ${description
                    ? html`<div
                style="margin-top: 4px; font-size: 0.85em; color: var(--secondary-text-color);"
              >
                ${description}
              </div>`
                    : ""}
        </div>
      `;
        }
        _withAlpha(hex, alpha = 0.85) {
            if (hex.startsWith("#")) {
                if (hex.length === 4)
                    hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
                const bigint = parseInt(hex.slice(1), 16);
                const r = (bigint >> 16) & 255;
                const g = (bigint >> 8) & 255;
                const b = bigint & 255;
                return `rgba(${r},${g},${b},${alpha})`;
            }
            return hex;
        }

        static get styles() {
            return css`
        :host {
          display: block;
          width: 100%;
        }
        .stundenplan {
          border-collapse: collapse;
          width: 100%;
          font-family: sans-serif;
        }
        .stundenplan th,
        .stundenplan td {
          border: 1px solid var(--divider-color, #ccc);
          padding: 8px;
        }

        .stundenplan td:first-child {
          font-weight: bold;
          background: rgba(0, 0, 0, 0.05);
          white-space: nowrap;
        }
        .room {
          font-size: 0.75em;
          color: var(--secondary-text-color, #666);
          margin-top: 2px;
        }
        .highlight {
          background: var(--primary-color);
          color: white;
        }
        .highlight-col-cell {
          border-left: 2px solid var(--primary-color);
          border-right: 2px solid var(--primary-color);
        }
        .pause td,
        .pause {
          background: rgba(200, 200, 200, 0.3) !important;
          font-style: italic;
          text-align: center;
        }
        .active-row td {
          border-bottom: 3px solid var(--primary-color);
          font-weight: bold;
        }
      `;
        }

        static getConfigElement() {
            return document.createElement("student-schedule-card-editor");
        }

        static getStubConfig() {
            return {
                name: "Student Schedule",
                description: "Week A",
                default_placeholder: "--",
                show_highlight: true,
                show_rooms: true,
                shorten_room_names: true,
                show_breaks: true,
                break_label: "Break",
                days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                times: ["8:00 - 8:45", "8:45 - 9:30"],
                breaks: ["9:30 - 9:50"],
                subjects: {
                    1: [
                        { subject: "Math", room: "101" },
                        { subject: "English", room: "102" }
                    ],
                    2: [
                        { subject: "Science", room: "201" },
                        { subject: "Music", room: "203" }
                    ],
                    3: [
                        { free: true },
                        { free: true }
                    ],
                    4: [
                        { free: true },
                        { free: true }
                    ],
                    5: [
                        { free: true },
                        { free: true }
                    ],
                    6: [
                        { free: true },
                        { free: true }
                    ],
                    7: [
                        { free: true },
                        { free: true }
                    ]
                },
                colors: {
                    Math: "#2196f3",
                    English: "#4caf50",
                    Science: "#f44336",
                    Music: "#9c27b0",
                    FREE: "#cccccc"
                }
            };
        }
    }

    customElements.define("student-schedule-card", StudentScheduleCard);

    //MARK: Editor Component

    class StudentScheduleCardEditor extends LitElement {
        static get properties() {
            return {
                hass: {},
                config: {},
                _tabIndex: { type: Number },
                _data: {},
                _schema: {},
                _subjects: Array,
                _entity: String,
            };
        }

        constructor() {
            super();
            this._tabIndex = 0;
        }

        setConfig(config) {
            this.config = config || {};
            this._data = structuredClone(config);

            const placeholder = this._data.default_placeholder || "--";
            const updatedSubjects = this._data.subjects || {};

            for (const dayKey in updatedSubjects) {
                updatedSubjects[dayKey] = updatedSubjects[dayKey].map((fach) => {
                    if (typeof fach === "string") {
                        return fach.trim() === "" ? null : fach;
                    } else if (typeof fach === "object" && fach !== null) {
                        const entry = { ...fach };

                        // subject darf null bleiben – kein Platzhalter setzen
                        if ("subject" in entry && entry.subject?.trim?.() === "") {
                            entry.subject = null;
                        }

                        if ("room" in entry && entry.room?.trim?.() === "") {
                            entry.room = null;
                        }

                        // Nur automatisch auf free:true setzen, wenn es nicht schon definiert ist
                        if (!("free" in entry)) {
                            entry.free = !entry.subject && !entry.room;
                        }

                        return entry;
                    } else {
                        return null;
                    }
                });
            }

            this._data.subjects = updatedSubjects;
            this._subjects = this._extractSubjects(updatedSubjects);
            this._schema = this._generateSchema();
        }

        async firstUpdated() {
            if (!customElements.get("ha-entity-picker")) {
                try {
                    const huiCard = customElements.get("hui-entities-card");
                    if (huiCard && typeof huiCard.getConfigElement === "function") {
                        await huiCard.getConfigElement();
                        this.requestUpdate();
                    } else {
                        console.warn("ha-entity-picker could not be loaded automatically.");
                    }
                } catch (e) {
                    console.warn("Error loading ha-entity-picker", e);
                }
            }
        }

        render() {
            const tabs = ["General", "Times", "Colors", "Subjects"];
            return html`
        <mwc-tab-bar
          .activeIndex=${this._tabIndex}
          @MDCTabBar:activated=${(e) => (this._tabIndex = e.detail.index)}
        >
          ${tabs.map((t) => html`<mwc-tab label="${t}"></mwc-tab>`)}
        </mwc-tab-bar>
        <div class="card-content">
          ${this._tabIndex === 0 ? this._renderGeneralTab() : ""}
          ${this._tabIndex === 1 ? this._renderTimesTab() : ""}
          ${this._tabIndex === 2 ? this._renderColorsTab() : ""}
          ${this._tabIndex === 3 ? this._renderSubjectsTab() : ""}
        </div>
      `;
        }

        _renderGeneralTab() {
            return html`
    <ha-entity-picker
      .hass=${this.hass}
      .label="Child (person entity)"
      .value=${this._data.person_entity || ""}
      .includeDomains=${["person"]}
      configValue="person_entity"
      @value-changed=${(e) => this._valueChanged(e)}
    ></ha-entity-picker>

    ${!this._data.person_entity
                    ? html`
          <label class="editor-label">Name (optional):</label>
          <ha-textfield
            .value=${this._data.name || ""}
            @input=${(e) => this._updateField("name", e.target.value)}
          ></ha-textfield>

          <label class="editor-label">Icon (optional):</label>
          <ha-icon-picker
            .value=${this._data.icon || ""}
            @value-changed=${(e) => this._updateField("icon", e.detail.value)}
          ></ha-icon-picker>
        `
                    : ""}

    <label class="editor-label">Description (optional):</label>
    <ha-textfield
      .value=${this._data.description || ""}
      @input=${(e) => this._updateField("description", e.target.value)}
    ></ha-textfield>

    <label class="editor-label">Show Breaks:</label>
    <ha-switch
      .checked=${this._data.show_breaks !== false}
      @change=${(e) => this._updateField("show_breaks", e.target.checked)}
    ></ha-switch>

    ${this._data.show_breaks !== false
                    ? html`
          <label class="editor-label">Break label:</label>
          <ha-textfield
            .value=${this._data.break_label || ""}
            @input=${(e) => this._updateField("break_label", e.target.value)}
          ></ha-textfield>
        `
                    : ""}

    <label class="editor-label">Default Placeholder:</label>
    <ha-textfield
      .value=${this._data.default_placeholder}
      @input=${(e) => this._updateField("default_placeholder", e.target.value)}
    ></ha-textfield>

    <label class="editor-label">Weekdays (one per line):</label>
    <ha-code-editor
      mode="yaml"
      .value=${(this._data.days || []).join("\n")}
      @value-changed=${(e) => this._updateCode("days", e.detail.value)}
    ></ha-code-editor>

    <label class="editor-label">Display Options:</label>
    <div class="switch-row">
      <ha-formfield label="Highlight current time">
        <ha-switch
          .checked=${this._data.show_highlight !== false}
          @change=${(e) => this._updateField("show_highlight", e.target.checked)}
        ></ha-switch>
      </ha-formfield>

      <ha-formfield label="Show rooms">
        <ha-switch
          .checked=${this._data.show_rooms !== false}
          @change=${(e) => this._updateField("show_rooms", e.target.checked)}
        ></ha-switch>
      </ha-formfield>

      <ha-formfield label="Shorten room names">
        <ha-switch
          .checked=${this._data.shorten_room_names !== false}
          @change=${(e) => this._updateField("shorten_room_names", e.target.checked)}
        ></ha-switch>
      </ha-formfield>
    </div>
  `;
        }
        _renderTimesTab() {
            return html`
        <label class="editor-label">Times (one per line):</label>
        <ha-code-editor
          mode="yaml"
          .value=${(this._data.times || []).join("\n")}
          @value-changed=${(e) => this._updateCode("times", e.detail.value)}
        ></ha-code-editor>

        <label class="editor-label">Breaks (one per line):</label>
        <ha-code-editor
          mode="yaml"
          .value=${(this._data.breaks || []).join("\n")}
          @value-changed=${(e) => this._updateCode("breaks", e.detail.value)}
        ></ha-code-editor>
      `;
        }

        _updateField(key, value) {
            if (!this._data) return;

            // Sonderfall: Wenn sich der Placeholder ändert
            if (key === "default_placeholder") {
                const oldPlaceholder = this._previousPlaceholder;
                const newPlaceholder = value;

                this._data.default_placeholder = newPlaceholder;
                this._replacePlaceholder(oldPlaceholder, newPlaceholder);
                this._previousPlaceholder = newPlaceholder;
            } else {
                this._data = { ...this._data, [key]: value };
            }

            this._emit();
        }
        _replacePlaceholder(oldValue, newValue) {
            const days = this._data.days || ["Mo", "Di", "Mi", "Do", "Fr"];
            const times = this._data.times || [];
            const placeholder = newValue || "--";

            const subjects = structuredClone(this._data.subjects || {});

            for (let dayIndex = 1; dayIndex <= 7; dayIndex++) {
                const key = dayIndex.toString();
                if (!subjects[key]) subjects[key] = [];

                for (let i = 0; i < times.length; i++) {
                    if (!subjects[key][i]) {
                        subjects[key][i] = placeholder;
                    } else if (subjects[key][i] === oldValue) {
                        subjects[key][i] = placeholder;
                    }
                }
            }

            this._data.subjects = subjects;
            this._subjects = this._extractSubjects(subjects);
        }
        _updateCode(key, value) {
            this._data = {
                ...this._data,
                [key]: value
                    .split("\n")
                    .map((v) => v.trim())
                    .filter(Boolean),
            };
            this._emit();
        }

        _renderColorsTab() {
            return html`
    <div class="grid">
      ${["FREE", ...[...this._subjects]
                    .filter(
                        (subject) =>
                            subject &&
                            subject !== this._data.default_placeholder &&
                            subject !== "FREE"
                    )
                ].map((subject) => html`
        <label>${subject}</label>
        <input
          type="color"
          .value=${this._toColor(this._data.colors?.[subject])}
          @input=${(e) => this._updateColor(subject, e.target.value)}
        />
      `)}
    </div>
  `;
        }


        _renderSubjectsTab() {
            const days = this._data.days || ["Mo", "Di", "Mi", "Do", "Fr"];
            const times = this._data.times || [];
            const subjects = this._data.subjects || {};
            const placeholder = this._data.default_placeholder || "--";

            const splitAt = 4; // z.B. nach Donnerstag umbrechen
            const dayChunks = [days.slice(0, splitAt), days.slice(splitAt)];

            return html`
        ${dayChunks.map((dayGroup, groupIndex) => {
                const dayIndices = Object.fromEntries(
                    dayGroup.map((d, i) => [
                        (i + 1 + groupIndex * splitAt).toString(),
                        d,
                    ])
                );

                return html`
            <table class="matrix">
              <tr>
                <th></th>
                ${dayGroup.map((day) => html`<th>${day}</th>`)}
              </tr>
              ${times.map(
                    (time, rowIndex) => html`
                  <tr>
                    <td>${time}</td>
                    ${Object.keys(dayIndices).map((dayIndex) => {
                        const raw = subjects?.[dayIndex]?.[rowIndex];
                        let subject = "";
                        let room = "";
                        let entry = {};

                        if (typeof raw === "object" && raw !== null) {
                            subject = raw.subject || "";
                            room = raw.room || "";
                            entry = raw;
                        } else if (typeof raw === "string") {
                            subject = raw;
                            entry = { subject };
                        }

                        return html`<td>
                        <input
                          type="text"
                          placeholder="Subject"
                          .value=${subject}
                          class="input-subject"
                          @input=${(e) =>
                                this._updateSubjectField(
                                    dayIndex,
                                    rowIndex,
                                    "subject",
                                    e.target.value
                                )}
                        />
                        <input
                          type="text"
                          placeholder="Room"
                          .value=${room}
                          class="input-room"
                          @input=${(e) =>
                                this._updateSubjectField(
                                    dayIndex,
                                    rowIndex,
                                    "room",
                                    e.target.value
                                )}
                        />
                        <label
                          style="font-size: 0.7em; display: flex; align-items: center; gap: 4px;"
                        >
                          <input
                            type="checkbox"
                            .checked=${entry?.free === true}
                            @change=${(e) =>
                                this._updateSubjectField(
                                    dayIndex,
                                    rowIndex,
                                    "free",
                                    e.target.checked
                                )}
                          />
                          Free
                        </label>
                      </td>`;
                    })}
                  </tr>
                `
                )}
            </table>
            <br />
          `;
            })}
      `;
        }

        _updateSubjectField(dayIndex, rowIndex, field, value) {
            const subj = { ...(this._data.subjects || {}) };
            if (!subj[dayIndex]) subj[dayIndex] = [];

            let entry = subj[dayIndex][rowIndex];

            if (typeof entry !== "object" || entry === null) {
                entry = { subject: typeof entry === "string" ? entry : "" };
            }

            if (field === "free") {
                entry.free = value === true;
            } else {
                entry[field] = value;

                // Automatische free-Erkennung, falls Subject und Room leer
                // const isSubjectEmpty = !entry.subject || entry.subject.trim() === "";
                // const isRoomEmpty = !entry.room || entry.room.trim() === "";
                // entry.free = isSubjectEmpty && isRoomEmpty;
            }

            if (field === "subject" && value.trim() === "") {
                entry.subject = null;
            }
            // Aufräumen
            if (!entry.free) delete entry.free;

            // Leeres Objekt? Dann ganz rausnehmen
            if (Object.keys(entry).length === 0) {
                delete subj[dayIndex][rowIndex];
            } else {
                subj[dayIndex][rowIndex] = entry;
            }

            this._data.subjects = subj;
            this._subjects = this._extractSubjects(subj);
            this._emit();
        }

        _extractSubjects(subjects) {
            const s = new Set();
            Object.values(subjects).forEach((row) =>
                row.forEach((fach) => {
                    if (typeof fach === "object" && fach?.free === true) {
                        s.add("FREE");
                    } else if (typeof fach === "object" && fach.subject) {
                        s.add(fach.subject);
                    } else if (typeof fach === "string") {
                        s.add(fach);
                    }
                })
            );
            return s;
        }

        _updateSubject(dayIndex, rowIndex, value) {
            const subj = { ...(this._data.subjects || {}) };
            if (!subj[dayIndex]) subj[dayIndex] = [];
            subj[dayIndex][rowIndex] = value;
            this._data.subjects = subj;
            this._subjects = this._extractSubjects(subj);
            this._emit();
        }

        _toColor(val) {
            if (!val || val.startsWith("rgba")) return "#888888";
            return val;
        }
        _emit() {
            this.dispatchEvent(
                new CustomEvent("config-changed", {
                    detail: { config: this._data },
                    bubbles: true,
                    composed: true,
                })
            );
        }
        _updateColor(fach, color) {
            const newColors = { ...(this._data.colors || {}) };
            newColors[fach] = color;
            this._data.colors = newColors;
            this._emit();
        }

        _valueChanged(ev) {
            ev.stopPropagation();
            const value = ev.detail.value;

            this._data = { ...this._data, person_entity: value };
            this._emit();
        }

        _generateSchema() {
            return {
                general: [
                    { name: "name", selector: { text: {} } },
                    { name: "icon", selector: { icon: {} } },
                    { name: "person_entity", selector: { entity: { domain: "person" } } },
                    { name: "description", selector: { text: {} } },
                    { name: "show_breaks", selector: { boolean: {} } },
                    { name: "break_label", selector: { text: {} } },
                    { name: "default_placeholder", selector: { text: {} } },
                    { name: "show_highlight", selector: { boolean: {} } },
                    { name: "show_rooms", selector: { boolean: {} } },
                    { name: "shorten_room_names", selector: { boolean: {} } },
                ],
                times: [
                    { name: "times", selector: { text: { multiline: true } } },
                    { name: "breaks", selector: { text: { multiline: true } } },
                ],
            };
        }

        static get styles() {
            return css`
        .grid {
          display: grid;
          grid-template-columns: auto auto;
          gap: 10px;
          margin: 1em;
        }
        table.matrix {
          width: 100%;
          border-collapse: collapse;
          margin-top: 1em;
        }
        .matrix td,
        .matrix th {
          border: 1px solid var(--divider-color, #444);
          padding: 4px;
        }
        .matrix input {
          width: 100%;
          border: none;
          background: transparent;
          color: inherit;
        }
        .editor-label {
          font-size: 0.85rem;
          font-weight: 500;
          margin-top: 1em;
          display: block;
          color: var(--secondary-text-color);
        }
        .input-subject,
        .input-room {
          width: 100%;
          box-sizing: border-box;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          border: 1px solid var(--divider-color);
          padding: 2px;
          margin-bottom: 2px;
          font-size: 0.8em;
        }
        .input-room {
          opacity: 0.7;
          font-style: italic;
        }
        .switch-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 0.5em;
  margin-bottom: 1em;
}
.switch-row ha-formfield {
  display: flex;
  align-items: center;
  gap: 8px;
}

      `;
        }
    }

    customElements.define(
        "student-schedule-card-editor",
        StudentScheduleCardEditor
    );

    window.customCards = window.customCards || [];
    window.customCards.push({
        type: "student-schedule-card",
        name: "Student Schedule Card",
        description: "A configurable schedule (timetable) card for Home Assistant.",
        preview: true,
        documentationURL: "",
        configElement: "student-schedule-card-editor",
    });
})(
    window.LitElement ||
    Object.getPrototypeOf(customElements.get("hui-masonry-view"))
);

console.info(
    `%c 📘 STUDENT-SCHEDULE-CARD %c v1.0.48 `,
    "background: #3f51b5; color: white; font-weight: bold; padding: 2px 8px; border-radius: 4px;",
    "background: #009688; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px;"
);
