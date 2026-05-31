# Copyright (C) 2026 ZMS
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
from PySide6.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
                               QPushButton, QLabel, QScrollArea, QStackedWidget,
                               QFrame, QGridLayout, QSizePolicy, QApplication)
from PySide6.QtCore import Qt, QTimer, QSize
from PySide6.QtGui import QFont, QIcon

from api_client import GrowattAPI
from chart_widgets import BarChart, LineChart

DARK = '#0b0e14'
CARD = '#131820'
CARD_HOVER = '#1a2230'
BORDER = '#232d3f'
TEXT = '#e8edf5'
DIM = '#8892a6'
ACCENT = '#f5c842'
GREEN = '#34d399'
RED = '#f87171'
BLUE = '#60a5fa'
PURPLE = '#a78bfa'

class PlantCard(QFrame):
    def __init__(self, plant_data, onClick):
        super().__init__()
        self.plant_data = plant_data
        self._onClick = onClick
        self.setup_ui()
        self.setCursor(Qt.PointingHandCursor)

    def setup_ui(self):
        d = self.plant_data
        name = d.get('name') or d.get('plantName') or f"Plant {d.get('plant_id') or d.get('id', '?')}"
        is_online = str(d.get('status', '0')) in ('1', 'online', '0')
        status_text = 'Online' if is_online else 'Offline'
        status_cls = GREEN if is_online else RED

        self.setStyleSheet(f'''
            PlantCard {{
                background: {CARD};
                border: 1px solid {BORDER};
                border-radius: 12px;
                padding: 20px;
            }}
            PlantCard:hover {{
                background: {CARD_HOVER};
                border-color: #b8941a;
            }}
        ''')

        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(14)

        header = QHBoxLayout()
        name_label = QLabel(name)
        name_label.setStyleSheet(f'font-size: 16px; font-weight: 600; color: {TEXT};')
        header.addWidget(name_label)

        status_label = QLabel(status_text)
        status_label.setStyleSheet(f'''
            font-size: 11px; font-weight: 600; color: {status_cls};
            background: rgba({','.join(str(c) for c in (status_cls == GREEN and (52,211,153) or (248,113,113)) )}, 50);
            padding: 3px 10px; border-radius: 10px;
        ''')
        header.addStretch()
        header.addWidget(status_label)
        layout.addLayout(header)

        stats = QGridLayout()
        stats.setSpacing(10)

        total_energy = d.get('total_energy') or d.get('eTotal') or '—'
        today_energy = d.get('today_energy') or d.get('eToday') or '—'
        peak_power = d.get('peak_power') or d.get('nominalPower') or '—'
        location = d.get('city') or d.get('country') or '—'

        items = [
            ('Total kWh', str(total_energy), ACCENT),
            ('Today kWh', str(today_energy), GREEN),
            ('Peak (kW)', str(peak_power), BLUE),
            ('Location', str(location), PURPLE),
        ]
        for i, (label, val, color) in enumerate(items):
            cell = QVBoxLayout()
            v = QLabel(val)
            v.setStyleSheet(f'font-size: 16px; font-weight: 700; color: {color};')
            l = QLabel(label)
            l.setStyleSheet(f'font-size: 10px; color: {DIM}; text-transform: uppercase;')
            cell.addWidget(v)
            cell.addWidget(l)
            stats.addLayout(cell, i // 2, i % 2)

        layout.addLayout(stats)

    def mousePressEvent(self, event):
        self._onClick(self.plant_data)


class MainWindow(QMainWindow):
    def __init__(self, email='', password='', token=''):
        super().__init__()
        self.email = email
        self.password = password
        self._token = token
        self.current_plant = None
        self.current_period = 'daily'

        self.setWindowTitle('myGrowatt - PV Plant Monitor')
        self.setMinimumSize(1000, 700)
        self.resize(1200, 800)

        self.api = GrowattAPI(self)
        self.api.finished.connect(self._on_login_result)
        self.api.error.connect(self._on_api_error)

        self.central = QWidget()
        self.setCentralWidget(self.central)
        self.main_layout = QVBoxLayout(self.central)
        self.main_layout.setContentsMargins(0, 0, 0, 0)
        self.main_layout.setSpacing(0)

        self.setup_topbar()
        self.setup_content()

        self.setStyleSheet(f'QMainWindow {{ background: {DARK}; }}')

        self.api.login(email, password, token)

    def _on_login_result(self, data):
        back = data.get('back', data)
        token = back.get('user', {}).get('token') or back.get('token') or self._token
        self.account_name = back.get('user', {}).get('accountName', self.email)
        QTimer.singleShot(100, self.load_plants)

    def setup_topbar(self):
        bar = QFrame()
        bar.setFixedHeight(56)
        bar.setStyleSheet(f'background: {CARD}; border-bottom: 1px solid {BORDER};')
        bar_layout = QHBoxLayout(bar)
        bar_layout.setContentsMargins(24, 0, 24, 0)

        title = QLabel('myGrowatt')
        title.setStyleSheet(f'font-size: 18px; font-weight: 700; color: {TEXT};')
        bar_layout.addWidget(title)

        if self.account_name:
            acct = QLabel(self.account_name)
            acct.setStyleSheet(f'font-size: 12px; color: {DIM}; padding-left: 12px; margin-left: 12px; border-left: 1px solid {BORDER};')
            bar_layout.addWidget(acct)

        bar_layout.addStretch()

        refresh_btn = QPushButton('Refresh')
        refresh_btn.setStyleSheet(f'''
            QPushButton {{
                padding: 8px 16px; border: 1px solid {BORDER}; border-radius: 8px;
                background: transparent; color: {TEXT}; font-size: 13px;
            }}
            QPushButton:hover {{ background: {CARD_HOVER}; border-color: #b8941a; }}
        ''')
        refresh_btn.clicked.connect(self._on_refresh)
        bar_layout.addWidget(refresh_btn)

        self.main_layout.addWidget(bar)

    def setup_content(self):
        self.content = QWidget()
        self.content.setStyleSheet(f'background: {DARK};')
        content_layout = QHBoxLayout(self.content)
        content_layout.setContentsMargins(0, 0, 0, 0)

        self.stack = QStackedWidget()

        # Dashboard page
        self.dashboard_page = QWidget()
        dp_layout = QVBoxLayout(self.dashboard_page)
        dp_layout.setContentsMargins(24, 24, 24, 24)
        dp_layout.setSpacing(16)

        header = QHBoxLayout()
        self.plants_count_label = QLabel('Your Plants')
        self.plants_count_label.setStyleSheet(f'font-size: 20px; font-weight: 600; color: {TEXT};')
        header.addWidget(self.plants_count_label)
        header.addStretch()
        self.summary_label = QLabel()
        self.summary_label.setStyleSheet(f'color: {DIM}; font-size: 13px;')
        header.addWidget(self.summary_label)
        dp_layout.addLayout(header)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setStyleSheet(f'QScrollArea {{ border: none; background: {DARK}; }}')
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)

        self.plants_container = QWidget()
        self.plants_container.setStyleSheet(f'background: {DARK};')
        self.plants_grid = QGridLayout(self.plants_container)
        self.plants_grid.setSpacing(16)
        scroll.setWidget(self.plants_container)
        dp_layout.addWidget(scroll)

        self.stack.addWidget(self.dashboard_page)

        # Detail page
        self.detail_page = QWidget()
        dd_layout = QVBoxLayout(self.detail_page)
        dd_layout.setContentsMargins(24, 24, 24, 24)
        dd_layout.setSpacing(16)

        back_btn = QPushButton('← All Plants')
        back_btn.setStyleSheet(f'''
            QPushButton {{
                padding: 8px 16px; border: 1px solid {BORDER}; border-radius: 8px;
                background: transparent; color: {TEXT}; font-size: 13px;
                max-width: 150px;
            }}
            QPushButton:hover {{ background: {CARD_HOVER}; border-color: #b8941a; }}
        ''')
        back_btn.clicked.connect(self._on_back)
        dd_layout.addWidget(back_btn)

        self.detail_header = QFrame()
        self.detail_header.setStyleSheet(f'background: {CARD}; border: 1px solid {BORDER}; border-radius: 12px; padding: 20px;')
        self.detail_header.setFixedHeight(100)
        self.detail_header_layout = QHBoxLayout(self.detail_header)
        dd_layout.addWidget(self.detail_header)

        # Tabs
        tab_bar = QFrame()
        tab_bar.setFixedHeight(44)
        tab_bar.setStyleSheet(f'background: {CARD}; border: 1px solid {BORDER}; border-radius: 8px;')
        tab_layout = QHBoxLayout(tab_bar)
        tab_layout.setContentsMargins(4, 4, 4, 4)
        tab_layout.setSpacing(2)

        self.tab_overview_btn = QPushButton('Overview')
        self.tab_charts_btn = QPushButton('Energy Charts')
        self.tab_overview_btn.setCheckable(True)
        self.tab_charts_btn.setCheckable(True)

        tab_style = f'''
            QPushButton {{
                padding: 8px 20px; border: none; border-radius: 6px;
                background: transparent; color: {DIM}; font-size: 13px; font-weight: 500;
            }}
            QPushButton:hover {{ background: rgba(255,255,255,0.03); color: {TEXT}; }}
            QPushButton:checked {{ background: {ACCENT}; color: {DARK}; font-weight: 600; }}
        '''
        self.tab_overview_btn.setStyleSheet(tab_style)
        self.tab_charts_btn.setStyleSheet(tab_style)
        self.tab_overview_btn.clicked.connect(lambda: self._switch_tab('overview'))
        self.tab_charts_btn.clicked.connect(lambda: self._switch_tab('charts'))

        tab_layout.addWidget(self.tab_overview_btn)
        tab_layout.addWidget(self.tab_charts_btn)
        dd_layout.addWidget(tab_bar)

        # Tab content
        self.tab_content = QStackedWidget()

        # Overview tab
        self.overview_widget = QWidget()
        ov_layout = QHBoxLayout(self.overview_widget)
        ov_layout.setSpacing(16)

        self.overview_info = QFrame()
        self.overview_info.setStyleSheet(f'background: {CARD}; border: 1px solid {BORDER}; border-radius: 12px; padding: 18px;')
        self.overview_info_layout = QVBoxLayout(self.overview_info)
        ov_layout.addWidget(self.overview_info, 1)

        self.device_info = QFrame()
        self.device_info.setStyleSheet(f'background: {CARD}; border: 1px solid {BORDER}; border-radius: 12px; padding: 18px;')
        self.device_info_layout = QVBoxLayout(self.device_info)
        ov_layout.addWidget(self.device_info, 1)

        self.tab_content.addWidget(self.overview_widget)

        # Charts tab
        self.charts_widget = QWidget()
        ch_layout = QVBoxLayout(self.charts_widget)
        ch_layout.setSpacing(12)

        period_bar = QFrame()
        period_bar.setFixedHeight(38)
        period_bar.setStyleSheet(f'background: {CARD}; border: 1px solid {BORDER}; border-radius: 8px;')
        period_layout = QHBoxLayout(period_bar)
        period_layout.setContentsMargins(3, 3, 3, 3)
        period_layout.setSpacing(2)

        period_style = f'''
            QPushButton {{
                padding: 6px 16px; border: none; border-radius: 5px;
                background: transparent; color: {DIM}; font-size: 12px; font-weight: 500;
            }}
            QPushButton:hover {{ color: {TEXT}; }}
            QPushButton:checked {{ background: {ACCENT}; color: {DARK}; font-weight: 600; }}
        '''
        self.period_btns = {}
        for p in ['daily', 'monthly', 'yearly']:
            btn = QPushButton(p.capitalize())
            btn.setCheckable(True)
            btn.setStyleSheet(period_style)
            btn.clicked.connect(lambda checked, pp=p: self._switch_period(pp))
            self.period_btns[p] = btn
            period_layout.addWidget(btn)
        self.period_btns['daily'].setChecked(True)
        period_layout.addStretch()
        ch_layout.addWidget(period_bar)

        chart_grid = QHBoxLayout()
        self.energy_chart = BarChart()
        self.energy_chart.setStyleSheet(f'background: {CARD}; border: 1px solid {BORDER}; border-radius: 12px;')
        chart_grid.addWidget(self.energy_chart)

        self.power_chart = LineChart()
        self.power_chart.setStyleSheet(f'background: {CARD}; border: 1px solid {BORDER}; border-radius: 12px;')
        chart_grid.addWidget(self.power_chart)

        ch_layout.addLayout(chart_grid)
        self.tab_content.addWidget(self.charts_widget)

        dd_layout.addWidget(self.tab_content, 1)

        self.stack.addWidget(self.detail_page)
        content_layout.addWidget(self.stack)
        self.main_layout.addWidget(self.content, 1)

    def _on_api_error(self, msg):
        from PySide6.QtWidgets import QMessageBox
        QMessageBox.critical(self, 'API Error', f'Growatt API error:\n{msg}')

    def load_plants(self):
        self.plants_count_label.setText('Loading plants...')
        self.api.finished.connect(self._on_plants_loaded, Qt.UniqueConnection)
        self.api.get_plants()

    def _on_plants_loaded(self, data):
        plants = data.get('data', {}).get('plants') or data.get('plants') or []
        if not plants:
            plants = [data] if isinstance(data, dict) and 'plant_id' in data else []
        self.render_plants(plants)

    def render_plants(self, plants):
        # clear grid
        while self.plants_grid.count():
            item = self.plants_grid.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        self.plants_count_label.setText(f'{len(plants)} Plant{"s" if len(plants) != 1 else ""}')

        online = sum(1 for p in plants if str(p.get('status', '0')) in ('1', 'online', '0'))
        total_energy = sum(float(p.get('total_energy') or p.get('eTotal') or 0) for p in plants)
        self.summary_label.setText(f'{len(plants)} plants · {online} online · {total_energy:.1f} kWh total')

        cols = max(1, self.width() // 380)
        for i, p in enumerate(plants):
            card = PlantCard(p, self._on_plant_click)
            self.plants_grid.addWidget(card, i // cols, i % cols)

    def _on_plant_click(self, plant_data):
        plant_id = plant_data.get('plant_id') or plant_data.get('id')
        if not plant_id:
            return
        self.current_plant = plant_id
        self.stack.setCurrentIndex(1)
        self.load_plant_detail(plant_id)

    def load_plant_detail(self, plant_id):
        self.tab_overview_btn.setChecked(True)
        self.tab_charts_btn.setChecked(False)
        self.tab_content.setCurrentIndex(0)
        self.load_overview(plant_id)
        self.load_charts(plant_id, self.current_period)

    def load_overview(self, plant_id):
        self.api.finished.connect(self._on_overview_loaded, Qt.UniqueConnection)
        self.api.get_plant_detail(plant_id)
        self.api.get_plant_overview(plant_id)
        self.api.get_devices(plant_id)
        self._pending_overview = 3
        self._overview_data = {}

    def _on_overview_loaded(self, data):
        if not hasattr(self, '_pending_overview'):
            return
        self._pending_overview -= 1
        if 'devices' in (data.get('data') or data):
            self._overview_data['devices'] = data
        elif 'energys' in (data.get('data') or data):
            self._overview_data['overview'] = data
        elif 'plant' in (data.get('data') or data) or 'name' in (data.get('data') or {}):
            self._overview_data['details'] = data

        if self._pending_overview <= 0:
            self.render_overview()

    def render_overview(self):
        # Clear
        while self.overview_info_layout.count():
            item = self.overview_info_layout.takeAt(0)
            if item.widget(): item.widget().deleteLater()
        while self.device_info_layout.count():
            item = self.device_info_layout.takeAt(0)
            if item.widget(): item.widget().deleteLater()

        # Clear detail header
        while self.detail_header_layout.count():
            item = self.detail_header_layout.takeAt(0)
            if item.widget(): item.widget().deleteLater()

        details = (self._overview_data.get('details', {}) or {}).get('data', {})
        overview = (self._overview_data.get('overview', {}) or {}).get('data', {})
        devices_data = (self._overview_data.get('devices', {}) or {}).get('data', {}).get('devices') or \
                       (self._overview_data.get('devices', {}) or {}).get('devices') or []

        # Detail header stats
        metrics = [
            ('Name', details.get('name', '—'), ''),
            ('Total', f"{overview.get('total_energy', 0)} kWh", ACCENT),
            ('Today', f"{overview.get('today_energy', 0)} kWh", GREEN),
            ('Power', f"{float(overview.get('current_power', 0)) * 1000:.0f} W", BLUE),
        ]
        for label, val, color in metrics:
            w = QWidget()
            l = QVBoxLayout(w)
            l.setAlignment(Qt.AlignCenter)
            v = QLabel(str(val))
            v.setStyleSheet(f'font-size: 18px; font-weight: 700; color: {color or TEXT};')
            la = QLabel(label)
            la.setStyleSheet(f'font-size: 10px; color: {DIM};')
            l.addWidget(v)
            l.addWidget(la)
            self.detail_header_layout.addWidget(w)

        # Plant overview
        title = QLabel('Plant Overview')
        title.setStyleSheet(f'font-size: 13px; font-weight: 600; color: {DIM};')
        self.overview_info_layout.addWidget(title)
        rows = [
            ('Peak Power', f"{details.get('peak_power', '—')} kW"),
            ('Installed Area', str(details.get('installed_panel_area') or details.get('installed_dc_capacity') or '—')),
            ('Grid Type', str(details.get('grid_type', '—'))),
            ('Timezone', str(details.get('timezone', '—'))),
            ('Country', str(details.get('country', '—'))),
            ('Created', str(details.get('create_date', '—'))),
        ]
        for label, val in rows:
            row = QHBoxLayout()
            l = QLabel(label)
            l.setStyleSheet(f'color: {DIM}; font-size: 13px;')
            v = QLabel(val)
            v.setStyleSheet(f'color: {TEXT}; font-size: 13px; font-weight: 500;')
            row.addWidget(l)
            row.addStretch()
            row.addWidget(v)
            self.overview_info_layout.addLayout(row)

        # Device info
        title2 = QLabel('Devices')
        title2.setStyleSheet(f'font-size: 13px; font-weight: 600; color: {DIM};')
        self.device_info_layout.addWidget(title2)
        if devices_data:
            for d in devices_data:
                row = QHBoxLayout()
                l = QLabel(d.get('model', 'Inverter'))
                l.setStyleSheet(f'color: {DIM}; font-size: 13px;')
                v = QLabel(f"SN: {d.get('device_sn', '—')}")
                status = d.get('status', 0)
                v.setStyleSheet(f'color: {GREEN if status == 1 else RED}; font-size: 12px;')
                row.addWidget(l)
                row.addStretch()
                row.addWidget(v)
                self.device_info_layout.addLayout(row)
        else:
            no_dev = QLabel('No devices found')
            no_dev.setStyleSheet(f'color: {DIM}; font-size: 13px;')
            self.device_info_layout.addWidget(no_dev)

    def load_charts(self, plant_id, period):
        self.api.finished.connect(self._on_energy_loaded, Qt.UniqueConnection)
        self.api.get_energy(plant_id, period)
        self.api.get_power(plant_id)

    def _on_energy_loaded(self, data):
        d = data.get('data', data)
        energys = d.get('energys') or d.get('data', {}).get('energys') or []
        if isinstance(energys, list):
            labels = [e.get('date', e.get('time', '')) for e in energys]
            values = [float(e.get('energy', 0)) for e in energys]
            self.energy_chart.set_data(labels, values, f'Energy — {self.current_period}')

        powers = d.get('powers') or d.get('data', {}).get('powers') or []
        if isinstance(powers, list) and powers:
            p_labels = [p.get('time', '') for p in powers]
            p_values = [float(p.get('power', 0)) for p in powers]
            self.power_chart.set_data(p_labels, p_values, 'Power — Today')

    def _switch_tab(self, tab):
        is_overview = tab == 'overview'
        self.tab_overview_btn.setChecked(is_overview)
        self.tab_charts_btn.setChecked(not is_overview)
        self.tab_content.setCurrentIndex(0 if is_overview else 1)

    def _switch_period(self, period):
        for k, btn in self.period_btns.items():
            btn.setChecked(k == period)
        self.current_period = period
        if self.current_plant:
            self.load_charts(self.current_plant, period)

    def _on_refresh(self):
        if self.current_plant and self.stack.currentIndex() == 1:
            self.load_plant_detail(self.current_plant)
        else:
            self.load_plants()

    def _on_back(self):
        self.stack.setCurrentIndex(0)
        self.current_plant = None
        self.current_period = 'daily'
        for k, btn in self.period_btns.items():
            btn.setChecked(k == 'daily')
        self.load_plants()

    def resizeEvent(self, event):
        super().resizeEvent(event)
        if hasattr(self, 'plants_grid'):
            cols = max(1, self.width() // 380)
            all_widgets = []
            while self.plants_grid.count():
                item = self.plants_grid.takeAt(0)
                if item.widget():
                    all_widgets.append(item.widget())
            for i, w in enumerate(all_widgets):
                self.plants_grid.addWidget(w, i // cols, i % cols)
