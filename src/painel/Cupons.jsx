// Painel > Cupons: criar, editar e desativar cupons de desconto.
import { useState } from 'react'
import Icone from '../componentes/Icone'
import { backend } from '../servicos/banco'
import { formatDate } from '../servicos/pedidos'
import { brl, int } from './formatos'
import { useAdmin, useAsync } from './hooks'
import { Confirm, Drawer, Empty, ErrorBox, Field, PageHead, Toggle } from './interface'

const EMPTY = { id: null, code: '', kind: 'percent', value: 10, active: true, startsAt: '', expiresAt: '', maxUses: '' }

// datetime-local <-> ISO (fuso do navegador)
const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : '')

const describe = (c) => (c.kind === 'percent' ? `${Number(c.value)}% off` : `${brl(c.value)} off`)

function couponState(c) {
  const now = Date.now()
  if (!c.active) return { label: 'Desligado', tone: 'neutral' }
  if (c.expires_at && new Date(c.expires_at) < now) return { label: 'Expirado', tone: 'neutral' }
  if (c.starts_at && new Date(c.starts_at) > now) return { label: 'Agendado', tone: 'warning' }
  if (c.max_uses && c.used_count >= c.max_uses) return { label: 'Esgotado', tone: 'neutral' }
  return { label: 'Valendo', tone: 'good' }
}

function CouponForm({ initial, onSaved, onCancel }) {
  const { notify } = useAdmin()
  const [f, setF] = useState(initial)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)

  const errors = {}
  if (!/^[A-Z0-9_-]{3,30}$/.test(f.code)) errors.code = 'De 3 a 30 caracteres: letras, números, _ ou -.'
  if (!(Number(f.value) > 0)) errors.value = 'Informe o valor do desconto.'
  if (f.kind === 'percent' && Number(f.value) > 100) errors.value = 'Máximo de 100%.'
  if (f.maxUses !== '' && !(Number(f.maxUses) >= 1)) errors.maxUses = 'Deixe em branco ou use 1 ou mais.'
  if (f.startsAt && f.expiresAt && new Date(f.expiresAt) <= new Date(f.startsAt)) errors.expiresAt = 'O fim precisa ser depois do início.'
  const show = (k) => (touched ? errors[k] : undefined)

  const save = async (e) => {
    e.preventDefault()
    setTouched(true)
    if (Object.keys(errors).length) return
    setBusy(true)
    try {
      await backend.admin.saveCoupon({
        id: f.id,
        code: f.code,
        kind: f.kind,
        value: Number(f.value),
        active: f.active,
        startsAt: fromLocalInput(f.startsAt),
        expiresAt: fromLocalInput(f.expiresAt),
        maxUses: f.maxUses === '' ? null : Number(f.maxUses),
      })
      notify(f.id ? 'Cupom atualizado.' : `Cupom ${f.code} criado.`)
      onSaved()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="xform" onSubmit={save} id="coupon-form">
      <Field label="Código" hint="O aluno digita este código no checkout." error={show('code')}>
        {(p) => (
          <input
            {...p}
            value={f.code}
            onChange={(e) => setF((x) => ({ ...x, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30) }))}
            placeholder="HOMEFIT10"
            autoComplete="off"
          />
        )}
      </Field>
      <div className="xform__row">
        <Field label="Tipo">
          {(p) => (
            <select {...p} value={f.kind} onChange={(e) => setF((x) => ({ ...x, kind: e.target.value }))}>
              <option value="percent">Porcentagem (%)</option>
              <option value="fixed">Valor fixo (R$)</option>
            </select>
          )}
        </Field>
        <Field label={f.kind === 'percent' ? 'Desconto (%)' : 'Desconto (R$)'} error={show('value')}>
          {(p) => (
            <input {...p} type="number" min="0.01" step="0.01" value={f.value} onChange={(e) => setF((x) => ({ ...x, value: e.target.value }))} />
          )}
        </Field>
      </div>
      <Field label="Limite de usos" hint="Em branco = sem limite." error={show('maxUses')}>
        {(p) => <input {...p} type="number" min="1" step="1" value={f.maxUses} onChange={(e) => setF((x) => ({ ...x, maxUses: e.target.value }))} />}
      </Field>
      <div className="xform__row">
        <Field label="Começa em (opcional)">
          {(p) => <input {...p} type="datetime-local" value={f.startsAt} onChange={(e) => setF((x) => ({ ...x, startsAt: e.target.value }))} />}
        </Field>
        <Field label="Termina em (opcional)" error={show('expiresAt')}>
          {(p) => <input {...p} type="datetime-local" value={f.expiresAt} onChange={(e) => setF((x) => ({ ...x, expiresAt: e.target.value }))} />}
        </Field>
      </div>
      <Toggle checked={f.active} onChange={(v) => setF((x) => ({ ...x, active: v }))} label={f.active ? 'Cupom ligado' : 'Cupom desligado'} />
      <div className="xdrawer__actions">
        <button type="button" className="btn btn--outline" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy && <span className="spinner" aria-hidden="true" />} {f.id ? 'Salvar cupom' : 'Criar cupom'}
        </button>
      </div>
    </form>
  )
}

export default function Cupons() {
  const { notify } = useAdmin()
  const list = useAsync(() => backend.admin.listCoupons(), [])
  const [editing, setEditing] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [busy, setBusy] = useState(false)
  const coupons = list.data ?? []

  const toggle = async (c) => {
    try {
      await backend.admin.saveCoupon({
        id: c.id,
        code: c.code,
        kind: c.kind,
        value: Number(c.value),
        active: !c.active,
        startsAt: c.starts_at,
        expiresAt: c.expires_at,
        maxUses: c.max_uses,
      })
      list.mutate((cs) => cs.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)))
    } catch (e) {
      notify(e.message, 'error')
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await backend.admin.deleteCoupon(toDelete.id)
      list.mutate((cs) => cs.filter((x) => x.id !== toDelete.id))
      notify(`Cupom ${toDelete.code} excluído.`)
      setToDelete(null)
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHead
        title="Cupons"
        subtitle="Códigos de desconto para campanhas, alunos antigos ou parceiros."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setEditing(EMPTY)}>
            <Icone name="plus" size={18} /> Novo cupom
          </button>
        }
      />

      <ErrorBox error={list.error} onRetry={list.reload} />

      <section className={`acardx ${list.loading ? 'is-busy' : ''}`}>
        {list.firstLoad ? (
          <div className="xtable-skeleton" />
        ) : coupons.length === 0 ? (
          <Empty
            icon="ticket"
            title="Nenhum cupom ainda"
            text="Crie um código como HOMEFIT10 para dar 10% de desconto."
            action={
              <button type="button" className="btn btn--primary" onClick={() => setEditing(EMPTY)}>
                <Icone name="plus" size={18} /> Criar cupom
              </button>
            }
          />
        ) : (
          <div className="xtable-wrap">
            <table className="xtable">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Desconto</th>
                  <th className="num">Usos</th>
                  <th>Validade</th>
                  <th>Situação</th>
                  <th>Ligado</th>
                  <th className="col-actions">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => {
                  const st = couponState(c)
                  return (
                    <tr key={c.id}>
                      <td className="mono">
                        <strong>{c.code}</strong>
                      </td>
                      <td>{describe(c)}</td>
                      <td className="num">
                        {int(c.used_count)}
                        {c.max_uses ? ` / ${int(c.max_uses)}` : ''}
                      </td>
                      <td>
                        {c.expires_at ? `até ${formatDate(c.expires_at, false)}` : 'Sem prazo'}
                        {c.starts_at && <span className="cell-sub">a partir de {formatDate(c.starts_at, false)}</span>}
                      </td>
                      <td>
                        <span className={`chip-status chip-status--${st.tone}`}>{st.label}</span>
                      </td>
                      <td>
                        <Toggle checked={c.active} onChange={() => toggle(c)} label={`Ligar cupom ${c.code}`} hideLabel />
                      </td>
                      <td className="col-actions">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="xicon-btn"
                            onClick={() =>
                              setEditing({
                                id: c.id,
                                code: c.code,
                                kind: c.kind,
                                value: Number(c.value),
                                active: c.active,
                                startsAt: toLocalInput(c.starts_at),
                                expiresAt: toLocalInput(c.expires_at),
                                maxUses: c.max_uses ?? '',
                              })
                            }
                            aria-label={`Editar ${c.code}`}
                          >
                            <Icone name="edit" size={17} />
                          </button>
                          <button type="button" className="xicon-btn xicon-btn--danger" onClick={() => setToDelete(c)} aria-label={`Excluir ${c.code}`}>
                            <Icone name="trash" size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Drawer open={!!editing} title={editing?.id ? `Editar ${editing.code}` : 'Novo cupom'} onClose={() => setEditing(null)}>
        {editing && (
          <CouponForm
            key={editing.id ?? 'novo'}
            initial={editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null)
              list.reload()
            }}
          />
        )}
      </Drawer>

      <Confirm
        open={!!toDelete}
        title={`Excluir o cupom ${toDelete?.code}?`}
        text="Pedidos antigos continuam mostrando o cupom usado. Para só pausar, use o botão Ligado."
        confirmLabel="Excluir cupom"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </>
  )
}
