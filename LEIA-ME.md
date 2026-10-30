# Treino Integrado

App web instalável (PWA) para planejar e acompanhar musculação e corrida na mesma semana.
Todos os dados (treinos, corridas, peso, medidas, fotos e recuperação) ficam salvos no próprio aparelho, em um único histórico.

## Rodar no computador

```bash
node serve.js
```

Depois abra http://localhost:5173.

## Usar no celular (com GPS)

O GPS do navegador só funciona em endereço **HTTPS**. Publique a pasta `app-treino` em um host estático
(por exemplo Netlify, Vercel ou GitHub Pages), abra o link no celular e use "Adicionar à tela inicial".

- Mantenha a tela ligada durante a corrida: com a tela bloqueada, o navegador pode pausar o GPS.
- Sensor cardíaco por Bluetooth funciona no Chrome para Android.
- Os dados ficam no navegador do aparelho. Use **Mais → Perfil e backup → Exportar backup** com frequência.

## Estrutura

- `js/store.js`, `js/db.js` – banco local (IndexedDB) e histórico único
- `js/schedule.js` – semana planejada, remarcações e status
- `js/analysis.js` – consistência, carga, recuperação, recordes e sugestões de progressão
- `js/exercises.js` – biblioteca com 70 exercícios (execução, postura, erros comuns)
- `js/resttimer.js` – cronômetro de descanso entre séries (som, vibração, notificação)
- `js/views/` – telas (início, calendário, musculação, corridas, cronômetro, cardio, biblioteca, metas e conquistas, relatório em PDF, evolução, corpo, recuperação, plano, perfil)
