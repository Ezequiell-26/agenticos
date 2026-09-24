import Icon from '../../components/Icon'

type GateState = 'Mapped' | 'Pending' | 'Blocked'

const gates: Array<[string, string, string, GateState]> = [
  ['PT-01', 'Provider integration coverage', 'Eight provider-plane integration tests are represented in the UI contract.', 'Mapped'],
  ['PT-02', 'Provider failover tests', 'Declared-order and disabled-failover behavior are represented.', 'Mapped'],
  ['PT-03', 'Health check integration', 'Health-driven selection is mapped to the provider test contract.', 'Mapped'],
  ['PT-04', 'Resilience patterns', 'Retry, quota, circuit and recovery behavior are represented as preview policy.', 'Mapped'],
  ['PT-05', 'Multi-provider orchestration', 'Healthy-provider selection and deterministic transport are represented.', 'Mapped'],
  ['PT-06', 'Coverage verification', 'CI must prove the declared provider integration coverage.', 'Pending'],
  ['PT-07', 'Security gate', 'Credential scoping and security checks require backend evidence.', 'Pending'],
  ['PT-08', 'Architecture gate', 'Architecture and boundary checks require repository evidence.', 'Pending'],
  ['PT-09', 'Rust verification', 'fmt, check, test and clippy must pass on the repository.', 'Pending'],
]

export default function ProviderAcceptanceBoard() {
  const mapped = gates.filter(([, , , state]) => state === 'Mapped').length
  return (
    <section className="provider-acceptance-board" aria-labelledby="provider-acceptance-board-title">
      <div className="provider-acceptance-board__head">
        <div><span className="eyebrow">Step 25 acceptance</span><h3 id="provider-acceptance-board-title">Provider acceptance board</h3><small>Presentation coverage of the authorized provider integration-test contract. Mapped is not the same as runtime-passed.</small></div>
        <div className="provider-acceptance-board__score"><strong>{mapped}</strong><span>/ {gates.length} mapped</span></div>
      </div>
      <div className="provider-acceptance-board__list">
        {gates.map(([id, title, detail, state]) => <div className="provider-acceptance-row" key={id}>
          <span className="provider-acceptance-row__id">{id}</span>
          <span><strong>{title}</strong><small>{detail}</small></span>
          <span className={'state-pill ' + (state === 'Mapped' ? 'state-pill--completed' : state === 'Blocked' ? 'state-pill--pending' : 'state-pill--active')}>{state}</span>
          <Icon name={state === 'Mapped' ? 'check' : state === 'Blocked' ? 'lock' : 'clock'} size={12} />
        </div>)}
      </div>
      <div className="callout"><Icon name="shield" size={14} /><span>Only the authorized Step 25 verification pipeline can convert Pending/Blocked gates into verified evidence. This board never authorizes or executes runtime operations.</span></div>
    </section>
  )
}
