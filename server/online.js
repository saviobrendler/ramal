// Ramal — contagem de pessoas usando o app agora.
// Cada aparelho envia um sinal ("batida") a cada minuto. O servidor guarda só um resumo do
// identificador (hash com sal, em memória) e a hora da última batida. Nada é gravado em disco,
// e a contagem zera ao reiniciar. Um aparelho conta como "online" por 3 minutos após a última batida.

const crypto = require('crypto');

const WINDOW_MS = 3 * 60e3;

class Online {
  constructor({ now = () => Date.now(), windowMs = WINDOW_MS, salt = crypto.randomBytes(16).toString('hex') } = {}) {
    this.now = now;
    this.windowMs = windowMs;
    this.salt = salt;
    this.seen = new Map(); // hash -> última batida (ms)
  }

  // Registra uma batida e devolve quantos aparelhos estão online.
  beat(dev) {
    const id = String(dev || '');
    if (!/^[a-z0-9-]{8,64}$/i.test(id)) throw new Error('Dispositivo inválido');
    const key = crypto.createHash('sha256').update(this.salt + id).digest('hex');
    this.seen.set(key, this.now());
    return this.count();
  }

  count() {
    this.prune();
    return this.seen.size;
  }

  prune() {
    const cut = this.now() - this.windowMs;
    for (const [k, t] of this.seen) if (t <= cut) this.seen.delete(k);
  }
}

module.exports = { Online, WINDOW_MS };
