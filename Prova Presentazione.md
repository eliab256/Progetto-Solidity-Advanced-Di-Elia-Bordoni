organizzazione del lavoro:
il progetto è composto da 4 smart contract: GovernanceDAO è il contratto principale che gestisce tutto ciò che riguarda proposte
decisioni e votazioni. Gli altri 3 contratti derivati gestiscono rispettivamente: token di governance, staking e treasury

il deploy dei tre contratti derivati viene fatto direttamente dal contratto Governance DAO, per cui dobbiamo passare nel constructor
del contratto principale anche i parametri necessari per gli altri 3.

- check proprietari e modificatori [ ]
- check deui valori passati come parametri nei vari constructor [ ]
- check dei vari require per ogni params [ ]

prova contratto token  
 construct - testare il mint per gli older users - testare che il contratto non si rompa se metto 0 in modo da non avere il mint [ ] ricordare nella presentazione che è opzionale - verificare che in caso di earlyadopter airdrop rimangano le quantità di token necessario sul contratto e che gli altri vengano inviati al contratto principale [ ] - verificre che in caso di non airdrop non rimangano token sul contratto e che vengano tutti inviati al contratto principale [ ] - verificare che in caso di airdrop la distribuzione avvenga correttamente [ ]

    funzioni
        - verificare le funzioni view e il funzionamento di active vesting period [ ]
        - verificare check elegibility claims [ ]
        - verificare le funzioni legate al claims [ ]
