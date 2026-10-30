// Painel > Configurações > Professores: os cards da seção "Conheça seus professores" do site.
import { useState } from 'react'
import Icone from '../componentes/Icone'
import { TrainerCard } from '../secoes/Professores'
import { TRAINER_LIMITS, cleanTrainers } from '../servicos/professores'
import { withKey } from './formatos'
import { Card, Field } from './interface'

const initials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?'

// Especialidades em etiquetas: digita e aperta Enter (ou vírgula); Backspace no campo vazio tira a última
function Specialties({ value, onChange, inputProps }) {
  const [draft, setDraft] = useState('')
  const full = value.length >= TRAINER_LIMITS.specialties

  const add = () => {
    const item = draft.replace(/\s+/g, ' ').trim().slice(0, TRAINER_LIMITS.specialty)
    setDraft('')
    if (!item || full || value.some((v) => v.toLowerCase() === item.toLowerCase())) return
    onChange([...value, item])
  }

  return (
    <div className="tchips">
      {value.map((s, i) => (
        <span key={s} className="tchips__chip">
          {s}
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Tirar ${s}`}>
            <Icone name="x" size={12} strokeWidth={3} />
          </button>
        </span>
      ))}
      {!full && (
        <input
          {...inputProps}
          value={draft}
          maxLength={TRAINER_LIMITS.specialty}
          placeholder={value.length ? 'Adicionar outra…' : 'Ex.: Hipertrofia'}
          onChange={(e) => setDraft(e.target.value.replace(',', ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add()
            } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
          }}
          onBlur={add}
        />
      )}
    </div>
  )
}

function TrainerEditor({ trainer, index, total, errors = {}, show, onChange, onMove, onRemove }) {
  const set = (k) => (e) => onChange({ ...trainer, [k]: e.target.value })
  const bioLength = trainer.bio.trim().length
  return (
    <article className="tedit">
      <header className="tedit__head">
        <span className="tedit__avatar" aria-hidden="true">
          {initials(trainer.name)}
        </span>
        <div className="tedit__who">
          <strong>{trainer.name.trim() || 'Novo professor'}</strong>
          <span>{[trainer.role, trainer.cref].filter((x) => x.trim()).join(' · ') || `Card ${index + 1} de ${total}`}</span>
        </div>
        <div className="tedit__actions">
          <button type="button" className="xicon-btn" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Mover para cima">
            <Icone name="chevronUp" size={18} />
          </button>
          <button type="button" className="xicon-btn" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Mover para baixo">
            <Icone name="chevronDown" size={18} />
          </button>
          <button type="button" className="xicon-btn xicon-btn--danger" onClick={onRemove} aria-label={`Remover ${trainer.name || 'professor'}`}>
            <Icone name="trash" size={17} />
          </button>
        </div>
      </header>

      <div className="tedit__body xform">
        <div className="xform__row">
          <Field label="Nome" error={show && errors.name}>
            {(p) => <input {...p} value={trainer.name} maxLength={TRAINER_LIMITS.name} placeholder="Ex.: Karol Martins" onChange={set('name')} />}
          </Field>
          <Field label="Cargo" optional>
            {(p) => <input {...p} value={trainer.role} maxLength={TRAINER_LIMITS.role} placeholder="Ex.: Personal Trainer" onChange={set('role')} />}
          </Field>
        </div>
        <div className="xform__row">
          <Field label="CREF" optional hint="Aparece ao lado do cargo.">
            {(p) => <input {...p} value={trainer.cref} maxLength={TRAINER_LIMITS.cref} placeholder="Ex.: CREF 012345-G/GO" onChange={set('cref')} />}
          </Field>
          <Field label="Instagram" optional hint="Vazio = sem botão do Instagram." error={show && errors.instagram}>
            {(p) => (
              <input
                {...p}
                value={trainer.instagram}
                maxLength={TRAINER_LIMITS.instagram}
                placeholder="https://instagram.com/perfil"
                onChange={set('instagram')}
              />
            )}
          </Field>
        </div>
        <Field
          label="Apresentação"
          about="O texto do card: experiência, foco e como ensina."
          aside={
            <span className={bioLength > TRAINER_LIMITS.bio ? 'is-over' : ''}>
              {bioLength}/{TRAINER_LIMITS.bio}
            </span>
          }
          error={show && errors.bio}
        >
          {(p) => <textarea {...p} rows={4} value={trainer.bio} onChange={set('bio')} />}
        </Field>
        <Field label="Especialidades" optional hint={`Digite e aperte Enter. Até ${TRAINER_LIMITS.specialties}.`}>
          {(p) => <Specialties value={trainer.specialties} onChange={(specialties) => onChange({ ...trainer, specialties })} inputProps={p} />}
        </Field>
      </div>
    </article>
  )
}

const emptyTrainer = () => withKey({ name: '', role: 'Personal Trainer', cref: '', bio: '', specialties: [], instagram: '' })

export default function EditorDeProfessores({ supported, trainers, onChange, errors, show }) {
  const full = trainers.length >= TRAINER_LIMITS.max
  const update = (i, t) => onChange(trainers.map((x, j) => (j === i ? t : x)))
  const move = (i, dir) => {
    const list = trainers.slice()
    ;[list[i], list[i + dir]] = [list[i + dir], list[i]]
    onChange(list)
  }
  const preview = cleanTrainers(trainers) ?? []

  return (
    <Card
      title="Professores"
      subtitle='Os cards da seção "Conheça seus professores" no site.'
      actions={
        supported && (
          <button type="button" className="btn btn--outline btn--sm" onClick={() => onChange([...trainers, emptyTrainer()])} disabled={full}>
            <Icone name="plus" size={16} /> Adicionar professor
          </button>
        )
      }
    >
      {!supported ? (
        <p className="xwarn">
          <Icone name="alert" size={16} />
          <span>
            Para editar os professores por aqui, rode o arquivo <code>supabase/migrations/0007_professores.sql</code> no SQL
            Editor do Supabase e recarregue esta página.
          </span>
        </p>
      ) : (
        <div className="tedits">
          {trainers.map((t, i) => (
            <TrainerEditor
              key={t.key}
              trainer={t}
              index={i}
              total={trainers.length}
              errors={errors?.list?.[i]}
              show={show}
              onChange={(next) => update(i, next)}
              onMove={(dir) => move(i, dir)}
              onRemove={() => onChange(trainers.filter((_, j) => j !== i))}
            />
          ))}

          {!trainers.length && (
            <p className={`xwarn ${show ? 'xwarn--error' : ''}`}>
              <Icone name="alert" size={16} />
              <span>O site precisa de pelo menos um professor. Clique em Adicionar professor.</span>
            </p>
          )}
          {full && <p className="xfield__hint">Máximo de {TRAINER_LIMITS.max} professores.</p>}

          {preview.length > 0 && (
            <div className="tpreview">
              <p className="tpreview__label">
                <Icone name="eye" size={16} /> Como fica no site
              </p>
              <div className="tpreview__cards">
                {preview.map((t, i) => (
                  <TrainerCard key={`${i}-${t.name}`} trainer={t} preview />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
