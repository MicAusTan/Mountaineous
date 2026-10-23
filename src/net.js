// Star topology: the host relays everyone's state. Only small state packets cross the wire; the world comes from the shared seed.
const PREFIX = 'mtnclimb-';
export class Net {
  constructor(h) { this.h = h; this.conns = new Map(); this.n = 0; this.pics = {}; this.id = 'h'; this.isHost = false; this.cfg = null; }
  host(code, cfg) {
    this.isHost = true; this.cfg = cfg;
    return new Promise((res, rej) => {
      this.peer = new Peer(PREFIX + code);
      this.peer.on('open', () => res(code)); this.peer.on('error', rej);
      this.peer.on('connection', (c) => {
        c.on('open', () => {
          c._id = 'p' + (++this.n); const others = ['h', ...this.conns.keys()];
          this.conns.set(c._id, c); c.send({ t: 'welcome', id: c._id, cfg: this.cfg, peers: others });
          for (const [pid, d] of Object.entries(this.pics)) c.send({ t: 'pic', id: pid, d });
          this.relay({ t: 'join', id: c._id }, c._id); this.h.join(c._id);
        });
        c.on('data', (d) => {
          if (d.t === 's') { d.id = c._id; this.h.state(d); this.relay(d, c._id) }
          else if (d.t === 'pic' && typeof d.d === 'string' && d.d.length < 200000) { this.pics[c._id] = d.d; this.h.pic?.(c._id, d.d); this.relay({ t: 'pic', id: c._id, d: d.d }, c._id) }
        });
        c.on('close', () => { this.conns.delete(c._id); this.relay({ t: 'leave', id: c._id }); this.h.leave(c._id) });
      });
    });
  }
  join(code) {
    return new Promise((res, rej) => {
      this.peer = new Peer(); const t = setTimeout(() => rej(new Error('timeout')), 10000);
      this.peer.on('error', rej);
      this.peer.on('open', () => {
        const c = this.up = this.peer.connect(PREFIX + code);
        c.on('data', (d) => {
          if (d.t === 'welcome') { clearTimeout(t); this.id = d.id; this.peers = d.peers; if (this.myPic) c.send({ t: 'pic', d: this.myPic }); res(d.cfg) }
          else if (d.t === 's') this.h.state(d); else if (d.t === 'join') this.h.join(d.id); else if (d.t === 'leave') this.h.leave(d.id); else if (d.t === 'pic') this.h.pic?.(d.id, d.d);
        });
        c.on('close', () => this.h.closed());
      });
    });
  }
  relay(msg, except) { for (const [id, c] of this.conns) if (id !== except && c.open) c.send(msg) }
  send(p, n) { const m = { t: 's', id: this.id, p, n }; if (this.isHost) this.relay(m); else if (this.up?.open) this.up.send(m) }
  get count() { return this.isHost ? this.conns.size + 1 : 0 }
}
