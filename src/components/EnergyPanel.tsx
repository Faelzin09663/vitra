import { energyBudget } from "../lib/energy";
import type { Store } from "../lib/store";
export function EnergyPanel({ store }: { store: Store }) {
  const budget = energyBudget(store);
  const kcal = (value: number | null) =>
    value === null ? "—" : value.toLocaleString("pt-BR") + " kcal";
  return (
    <section className="panel energy-panel">
      <h2>Seu balanço de hoje</h2>
      <div className="energy-grid">
        <div>
          <span>Base de manutenção</span>
          <strong>{kcal(budget.base)}</strong>
        </div>
        <div>
          <span>Treino estimado (líquido)</span>
          <strong>{kcal(budget.workoutKcal)}</strong>
        </div>
        <div>
          <span>Cardio estimado (líquido)</span>
          <strong>{kcal(budget.cardioKcal)}</strong>
        </div>
        <div>
          <span>Crédito aplicado à meta</span>
          <strong>+{kcal(budget.credit)}</strong>
        </div>
        <div>
          <span>Déficit aplicado</span>
          <strong>−{kcal(budget.automatic ? budget.deficit : 0)}</strong>
        </div>
        <div>
          <span>Meta de consumo</span>
          <strong>{kcal(budget.target)}</strong>
        </div>
      </div>
      <p className="energy-remaining">
        {budget.remaining >= 0
          ? "Margem na meta estimada"
          : "Acima da meta estimada"}
        : <strong>{kcal(Math.abs(budget.remaining))}</strong>
      </p>
      <p className="estimate-note">
        Somente treinos finalizados e cardio com duração entram no gasto.
        Estimativas por MET variam entre pessoas; não garantem um déficit real.
        Não some manualmente o mesmo cardio ao treino.
      </p>
      <p className="estimate-note">
        {!budget.automatic
          ? "Meta manual: o gasto é mostrado, mas não aumenta a meta. Ative o cálculo automático no Perfil."
          : budget.logged
            ? `Base de rotina leve + ${budget.creditPct}% do gasto líquido registrado, sem usar o fator de treino semanal.`
            : "Seu fator de atividade já considera exercício. Para adicionar atividades registradas, escolha esse método no Perfil."}
      </p>
      {budget.missingActivities > 0 && (
        <p className="estimate-note">
          {budget.missingActivities} atividade(s) sem estimativa: registro
          antigo, peso/duração ausente, atividade não reconhecida ou sessão fora
          do limite de 6 horas.
        </p>
      )}
    </section>
  );
}
