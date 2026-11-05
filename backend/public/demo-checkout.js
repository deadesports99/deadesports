/* Mock checkout page logic — external file because Helmet's CSP blocks inline scripts. */
(function () {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('orderId') || params.get('order_id') || '';

  const orderEl = document.getElementById('orderId');
  const amountEl = document.getElementById('amount');
  const statusEl = document.getElementById('status');
  const payBtn = document.getElementById('payBtn');
  const failBtn = document.getElementById('failBtn');

  orderEl.textContent = orderId || 'missing from URL';
  amountEl.textContent = 'see app';

  function setStatus(message, kind) {
    statusEl.textContent = message;
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  }

  function lock() {
    payBtn.disabled = true;
    failBtn.disabled = true;
  }

  async function post(outcome) {
    if (!orderId) {
      setStatus('No orderId in the checkout URL. Create an order first.', 'bad');
      return;
    }
    lock();
    setStatus('Contacting the mock gateway…');

    try {
      const res = await fetch('/api/payments/demo/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, outcome }),
      });
      const json = await res.json().catch(function () { return null; });
      const data = (json && json.data) || {};

      if (!res.ok) {
        setStatus((json && json.message) || 'Gateway call failed (HTTP ' + res.status + ')', 'bad');
        payBtn.disabled = false;
        failBtn.disabled = false;
        return;
      }

      if (data.status === 'CAPTURED') {
        setStatus(
          '✅ Payment captured and wallet credited.\n' +
            'Payment id: ' + data.paymentId + '\n' +
            'You can close this tab — the app is already updated.',
          'ok'
        );
      } else if (data.status === 'PENDING') {
        setStatus(
          '⏳ Payment authorised (PENDING).\n' +
            'Call POST /api/payments/verify with:\n' +
            '  orderId: ' + data.orderId + '\n' +
            '  paymentId: ' + data.paymentId + '\n' +
            '  signature: ' + data.signature,
          'ok'
        );
      } else {
        setStatus('Payment ' + (data.status || 'unknown') + '. You can close this tab.', 'bad');
      }
    } catch (err) {
      setStatus('Network error: ' + (err && err.message ? err.message : err), 'bad');
      payBtn.disabled = false;
      failBtn.disabled = false;
    }
  }

  payBtn.addEventListener('click', function () { return post('success'); });
  failBtn.addEventListener('click', function () { return post('failure'); });
})();
