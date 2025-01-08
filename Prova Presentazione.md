organizzazione del lavoro:
il progetto è composto da 4 smart contract: GovernanceDAO è il contratto principale che gestisce tutto ciò che riguarda proposte
decisioni e votazioni. Gli altri 3 contratti derivati gestiscono rispettivamente: token di governance, staking e treasury

il deploy dei tre contratti derivati viene fatto direttamente dal contratto Governance DAO, per cui dobbiamo passare nel constructor
del contratto principale anche i parametri necessari per gli altri 3.

- check proprietari e modificatori [ ]
- check deui valori passati come parametri nei vari constructor [ ]
- check dei vari require per ogni params [ ]

prova contratto token
