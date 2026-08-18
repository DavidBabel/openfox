import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Modal } from '../shared/SelfContainedModal'

export type EffortGateChoice = 'apply' | 'keep'

export interface EffortGateInfo {
  /** Effort currently in effect (what would be kept). */
  fromEffort?: string
  /** Effort the transition would apply. */
  toEffort: string
  /** Optional label of the transition target (e.g. an agent or workflow name). */
  contextLabel?: string
}

interface EffortChangeGateContextValue {
  requestEffortSwitch: (info: EffortGateInfo) => Promise<EffortGateChoice>
}

const EffortChangeGateContext = createContext<EffortChangeGateContextValue | null>(null)

interface Pending {
  info: EffortGateInfo
  resolve: (choice: EffortGateChoice) => void
}

export function EffortChangeGateProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)

  const requestEffortSwitch = useCallback(
    (info: EffortGateInfo) =>
      new Promise<EffortGateChoice>((resolve) => {
        setPending({ info, resolve })
      }),
    [],
  )

  const choose = useCallback((choice: EffortGateChoice) => {
    setPending((current) => {
      current?.resolve(choice)
      return null
    })
  }, [])

  const value = useMemo(() => ({ requestEffortSwitch }), [requestEffortSwitch])

  return (
    <EffortChangeGateContext.Provider value={value}>
      {children}
      {pending && (
        <Modal isOpen={true} onClose={() => choose('keep')} title="Reasoning effort change" size="sm">
          <p className="text-sm text-text-secondary">
            {pending.info.contextLabel ? (
              <>
                <span className="text-text-primary font-medium">{pending.info.contextLabel}</span> runs with reasoning
                effort <code className="text-accent-primary">{pending.info.toEffort}</code>
                {currentEffortClause(pending.info)}.
              </>
            ) : (
              <>
                Switching the reasoning effort to <code className="text-accent-primary">{pending.info.toEffort}</code>
                {currentEffortClause(pending.info)}.
              </>
            )}{' '}
            This may invalidate the LLM prefix cache — if it does, the next response will take longer while the context
            is reprocessed.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <ModalButton onClick={() => choose('keep')} variant="secondary">
              Keep current reasoning effort
            </ModalButton>
            <ModalButton onClick={() => choose('apply')} variant="danger">
              Apply the reasoning effort (invalidates cache)
            </ModalButton>
          </div>
        </Modal>
      )}
    </EffortChangeGateContext.Provider>
  )
}

function ModalButton({
  onClick,
  variant,
  children,
}: {
  onClick: () => void
  variant: 'primary' | 'secondary' | 'danger'
  children: ReactNode
}) {
  const className =
    variant === 'primary'
      ? 'px-3 py-1.5 text-sm rounded bg-accent-primary text-white hover:opacity-90 transition-colors'
      : variant === 'danger'
        ? 'px-3 py-1.5 text-sm rounded bg-accent-error text-white hover:opacity-90 transition-colors'
        : 'px-3 py-1.5 text-sm rounded bg-bg-tertiary text-text-primary hover:bg-border transition-colors'
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  )
}

function currentEffortClause(info: EffortGateInfo): ReactNode {
  if (!info.fromEffort || info.fromEffort === info.toEffort) return null
  return (
    <>
      {' '}
      (currently <code className="text-text-primary">{info.fromEffort}</code>)
    </>
  )
}

export function useEffortChangeGate(): EffortChangeGateContextValue {
  const ctx = useContext(EffortChangeGateContext)
  if (!ctx) {
    throw new Error('useEffortChangeGate must be used within EffortChangeGateProvider')
  }
  return ctx
}
