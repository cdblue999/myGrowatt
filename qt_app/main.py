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
import sys
from PySide6.QtWidgets import QApplication
from PySide6.QtCore import Qt

from settings_dialog import SettingsDialog
from main_window import MainWindow

DARK = '#0b0e14'
CARD = '#131820'
BORDER = '#232d3f'
TEXT = '#e8edf5'
ACCENT = '#f5c842'

STYLESHEET = f'''
QToolTip {{
    background: {CARD};
    border: 1px solid {BORDER};
    color: {TEXT};
    padding: 8px;
    border-radius: 6px;
    font-size: 12px;
}}
QScrollBar:vertical {{
    background: {DARK};
    width: 8px;
    border: none;
}}
QScrollBar::handle:vertical {{
    background: {BORDER};
    border-radius: 4px;
    min-height: 30px;
}}
QScrollBar::handle:vertical:hover {{
    background: #3a4558;
}}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
    height: 0;
}}
QScrollBar:horizontal {{
    background: {DARK};
    height: 8px;
    border: none;
}}
QScrollBar::handle:horizontal {{
    background: {BORDER};
    border-radius: 4px;
    min-width: 30px;
}}
QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {{
    width: 0;
}}
'''

def main():
    QApplication.setOrganizationName('myGrowatt')
    QApplication.setApplicationName('myGrowatt')

    app = QApplication(sys.argv)
    app.setStyle('Fusion')
    app.setStyleSheet(STYLESHEET)

    email, password, token = SettingsDialog.get_settings()
    if not email and not token:
        sys.exit(0)

    window = MainWindow(email, password, token)
    window.show()
    sys.exit(app.exec())

if __name__ == '__main__':
    main()
