import hashlib
import json

from PySide6.QtCore import QObject, Signal, QUrl
from PySide6.QtNetwork import QNetworkAccessManager, QNetworkRequest, QNetworkReply
from urllib.parse import urlencode

API_BASE = 'https://openapi.growatt.com/v1'
LOGIN_URL = 'https://openapi.growatt.com/newTwoLoginAPI.do'


def hash_password(password):
    pw_md5 = hashlib.md5(password.encode('utf-8')).hexdigest()
    out = list(pw_md5)
    for i in range(0, len(out), 2):
        if out[i] == '0':
            out[i] = 'c'
    return ''.join(out)


class GrowattAPI(QObject):
    finished = Signal(object)
    error = Signal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self._token = ''
        self._manager = QNetworkAccessManager(self)
        self._manager.finished.connect(self._on_reply)

    @property
    def is_logged_in(self):
        return bool(self._token)

    def login(self, email, password, token_override=''):
        if token_override:
            self._token = token_override
            self.finished.emit({'success': True, 'data': {'token': token_override}})
            return
        pw_hashed = hash_password(password)
        body = urlencode({'userName': email, 'password': pw_hashed}).encode()
        req = QNetworkRequest(QUrl(LOGIN_URL))
        req.setHeader(QNetworkRequest.ContentTypeHeader, b'application/x-www-form-urlencoded')
        req.setRawHeader(b'User-Agent', b'myGrowatt-Qt/1.0')
        self._manager.post(req, body)

    def _set_token_from_login(self, data):
        back = data.get('back', {})
        if back.get('success'):
            user = back.get('user', {})
            self._token = user.get('token', '')
            return True
        return False

    def _headers(self):
        return {
            b'token': self._token.encode(),
            b'User-Agent': b'myGrowatt-Qt/1.0'
        }

    def _get(self, endpoint, params=None):
        qs = urlencode(params or {})
        url = f'{API_BASE}{endpoint}'
        if qs:
            url += f'?{qs}'
        req = QNetworkRequest(QUrl(url))
        for k, v in self._headers().items():
            req.setRawHeader(k, v)
        self._manager.get(req)

    def _post(self, endpoint, data=None):
        data = data or {}
        qs = urlencode(data)
        url = f'{API_BASE}{endpoint}'
        req = QNetworkRequest(QUrl(url))
        for k, v in self._headers().items():
            req.setRawHeader(k, v)
        req.setHeader(QNetworkRequest.ContentTypeHeader, b'application/x-www-form-urlencoded')
        self._manager.post(req, qs.encode())

    def _on_reply(self, reply):
        if reply.error() != QNetworkReply.NoError:
            self.error.emit(reply.errorString())
            return
        data = reply.readAll().data()
        try:
            result = json.loads(data)
        except json.JSONDecodeError:
            self.error.emit('Invalid JSON response')
            return
        # Intercept login response to extract token
        url = reply.url().toString()
        if url == LOGIN_URL:
            if not self._set_token_from_login(result):
                msg = result.get('back', {}).get('msg', 'Login failed')
                self.error.emit(msg)
                return
            self.finished.emit(result)
            return
        self.finished.emit(result)

    def get_plants(self):
        self._get('/plant/list')

    def get_plant_detail(self, plant_id):
        self._get('/plant/details', {'plant_id': plant_id})

    def get_plant_overview(self, plant_id):
        self._get('/plant/data', {'plant_id': plant_id})

    def get_devices(self, plant_id):
        self._get('/device/list', {'plant_id': plant_id, 'page': '', 'perpage': ''})

    def get_energy(self, plant_id, period='daily'):
        import datetime
        cfg = {
            'daily': {'days': 7, 'time_unit': 'day'},
            'monthly': {'days': 365, 'time_unit': 'month'},
            'yearly': {'days': 365 * 5, 'time_unit': 'year'},
        }
        c = cfg.get(period, cfg['daily'])
        end = datetime.date.today()
        start = end - datetime.timedelta(days=c['days'])
        self._get('/plant/energy', {
            'plant_id': plant_id,
            'start_date': start.isoformat(),
            'end_date': end.isoformat(),
            'time_unit': c['time_unit'],
            'page': 1,
            'perpage': 100
        })

    def get_power(self, plant_id, date=None):
        import datetime
        d = date or datetime.date.today().isoformat()
        self._get('/plant/power', {'plant_id': plant_id, 'date': d})
