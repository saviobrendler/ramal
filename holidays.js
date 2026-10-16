// Ramal — feriados que usam a grade de domingo/feriado (a mesma regra do app e do servidor).
// Feriados nacionais e do estado do Rio. Atualizar a cada ano. Carnaval e ponto facultativo, não entram aqui.
(function (root) {
  const FERIADOS = {
    '2026-01-01': 'Confraternização universal',
    '2026-04-03': 'Sexta-feira Santa',
    '2026-04-21': 'Tiradentes',
    '2026-04-23': 'São Jorge (RJ)',
    '2026-05-01': 'Dia do Trabalho',
    '2026-06-04': 'Corpus Christi',
    '2026-09-07': 'Independência',
    '2026-10-12': 'Nossa Senhora Aparecida',
    '2026-11-02': 'Finados',
    '2026-11-15': 'Proclamação da República',
    '2026-11-20': 'Consciência Negra',
    '2026-12-25': 'Natal',
  };

  // Data no formato AAAA-MM-DD, pelos componentes locais (o app já monta a data com o horário de São Paulo).
  function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function isFeriado(d) {
    return Object.prototype.hasOwnProperty.call(FERIADOS, dateKey(d));
  }
  // 'util' | 'sab' | 'dom' (feriado conta como domingo).
  function dayTypeFor(d) {
    if (isFeriado(d)) return 'dom';
    const w = d.getDay();
    return w === 0 ? 'dom' : w === 6 ? 'sab' : 'util';
  }

  const api = { FERIADOS, dateKey, isFeriado, dayTypeFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RamalFeriados = api;
})(typeof window !== 'undefined' ? window : globalThis);
