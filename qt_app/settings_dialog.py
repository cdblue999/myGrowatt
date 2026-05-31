from PySide6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QLabel,
                               QLineEdit, QPushButton, QMessageBox,
                               QGroupBox, QCheckBox)
from PySide6.QtCore import QSettings, Qt


class SettingsDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.settings = QSettings('myGrowatt', 'myGrowatt')
        self.setWindowTitle('myGrowatt - Login')
        self.setFixedSize(520, 380)
        self.setup_ui()
        self.load_settings()

    def setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(14)
        layout.setContentsMargins(32, 28, 32, 28)

        title = QLabel('Growatt Login')
        title.setStyleSheet('font-size: 20px; font-weight: 700; color: #e8edf5;')
        layout.addWidget(title)

        desc = QLabel('Sign in with your Growatt web account to monitor your PV plants.')
        desc.setStyleSheet('color: #8892a6; font-size: 13px;')
        desc.setWordWrap(True)
        layout.addWidget(desc)

        email_label = QLabel('Email')
        email_label.setStyleSheet('color: #8892a6; font-size: 12px; margin-top: 4px;')
        layout.addWidget(email_label)

        self.email_input = QLineEdit()
        self.email_input.setPlaceholderText('your@email.com')
        self.email_input.setStyleSheet(self._input_style())
        layout.addWidget(self.email_input)

        pass_label = QLabel('Password')
        pass_label.setStyleSheet('color: #8892a6; font-size: 12px; margin-top: 4px;')
        layout.addWidget(pass_label)

        self.pass_input = QLineEdit()
        self.pass_input.setPlaceholderText('Your Growatt password')
        self.pass_input.setEchoMode(QLineEdit.Password)
        self.pass_input.setStyleSheet(self._input_style())
        layout.addWidget(self.pass_input)

        # Advanced: optional API token
        self.advanced_toggle = QCheckBox('Advanced: use API token instead')
        self.advanced_toggle.setStyleSheet('color: #8892a6; font-size: 12px; margin-top: 8px;')
        self.advanced_toggle.toggled.connect(self._on_advanced_toggle)
        layout.addWidget(self.advanced_toggle)

        self.token_group = QGroupBox()
        self.token_group.setVisible(False)
        tg_layout = QVBoxLayout(self.token_group)
        tg_layout.setContentsMargins(0, 0, 0, 0)

        token_label = QLabel('GROWATT_TOKEN (optional override)')
        token_label.setStyleSheet('color: #8892a6; font-size: 12px;')
        tg_layout.addWidget(token_label)

        self.token_input = QLineEdit()
        self.token_input.setPlaceholderText('Paste your Growatt API token here')
        self.token_input.setEchoMode(QLineEdit.Password)
        self.token_input.setStyleSheet(self._input_style())
        tg_layout.addWidget(self.token_input)

        layout.addWidget(self.token_group)
        layout.addStretch()

        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        self.cancel_btn = QPushButton('Cancel')
        self.cancel_btn.setStyleSheet(self._btn_style(False))
        self.cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(self.cancel_btn)

        self.save_btn = QPushButton('Login')
        self.save_btn.setStyleSheet(self._btn_style(True))
        self.save_btn.clicked.connect(self.save_and_accept)
        self.save_btn.setDefault(True)
        btn_layout.addWidget(self.save_btn)
        layout.addLayout(btn_layout)

        self.setStyleSheet('background-color: #131820;')

    def _on_advanced_toggle(self, checked):
        self.token_group.setVisible(checked)

    def _input_style(self):
        return '''
            QLineEdit {
                padding: 10px 14px;
                background: #1a2230;
                border: 1px solid #232d3f;
                border-radius: 8px;
                color: #e8edf5;
                font-size: 14px;
            }
            QLineEdit:focus {
                border-color: #f5c842;
            }
        '''

    def _btn_style(self, primary):
        if primary:
            return '''
                QPushButton {
                    padding: 10px 24px;
                    background: #f5c842;
                    color: #0b0e14;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                }
                QPushButton:hover {
                    background: #e0b83a;
                }
            '''
        return '''
            QPushButton {
                padding: 10px 24px;
                background: transparent;
                color: #8892a6;
                border: 1px solid #232d3f;
                border-radius: 8px;
                font-size: 14px;
            }
            QPushButton:hover {
                color: #e8edf5;
                border-color: #f5c842;
            }
        '''

    def load_settings(self):
        email = self.settings.value('email', '')
        token = self.settings.value('token', '')
        if email:
            self.email_input.setText(email)
            self.pass_input.setFocus()
        if token:
            self.token_input.setText(token)
            self.advanced_toggle.setChecked(True)

    def save_and_accept(self):
        email = self.email_input.text().strip()
        password = self.pass_input.text()
        token = self.token_input.text().strip() if self.advanced_toggle.isChecked() else ''
        if not email and not token:
            QMessageBox.warning(self, 'Missing Info', 'Enter your email or provide an API token.')
            return
        if not password and not token:
            QMessageBox.warning(self, 'Missing Password', 'Enter your password or provide an API token.')
            return
        self.settings.setValue('email', email)
        self.settings.setValue('token', token)
        self.accept()

    @staticmethod
    def get_settings(parent=None):
        dlg = SettingsDialog(parent)
        if dlg.exec() == QDialog.Accepted:
            return (dlg.email_input.text().strip(),
                    dlg.pass_input.text(),
                    dlg.token_input.text().strip() if dlg.advanced_toggle.isChecked() else '')
        return None, None, None
