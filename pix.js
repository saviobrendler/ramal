// Gera o código Pix "copia e cola" (BR Code, padrão do Banco Central) para uma chave Pix.
// Usado na página de apoio (apoio.html). Funciona no navegador e no Node (testes).

(function (root) {
  // Chave Pix aleatória que recebe os apoios do Ramal.
  const PIX_KEY = '572b6ba4-80f2-4907-b67d-ec507e2c7602';
  const NAME = 'RAMAL';          // nome do recebedor (sem acento: alguns bancos recusam caracteres especiais)
  const CITY = 'RIO DE JANEIRO';

  const tlv = (id, value) => id + String(value.length).padStart(2, '0') + value;

  // CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), exigido pelo BR Code.
  function crc16(str) {
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  // amount: número em reais (opcional). Sem valor, quem paga escolhe o valor no app do banco.
  function pixPayload({ key = PIX_KEY, amount, name = NAME, city = CITY, txid = '***' } = {}) {
    let p = tlv('00', '01');                          // formato do payload
    p += tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', key));
    p += tlv('52', '0000');                           // categoria do comerciante
    p += tlv('53', '986');                            // moeda: real
    if (amount) p += tlv('54', Number(amount).toFixed(2));
    p += tlv('58', 'BR');
    p += tlv('59', name.slice(0, 25));
    p += tlv('60', city.slice(0, 15));
    p += tlv('62', tlv('05', txid));
    p += '6304';
    return p + crc16(p);
  }

  const api = { PIX_KEY, pixPayload, crc16 };
  root.RamalPix = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
