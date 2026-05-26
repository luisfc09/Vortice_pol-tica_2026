# Brand assets — Vórtice

Coloque aqui os arquivos da marca. O frontend referencia esses caminhos
estáticos em `src/components/brand/VorticeLogo.tsx`.

## Arquivos esperados

| Arquivo                          | Quando aparece                                              |
|----------------------------------|-------------------------------------------------------------|
| `vortice-symbol.svg` (ou .png)   | Símbolo isolado (vortex). Usado em: sidebar (compacto),     |
|                                  | favicon visual em pages de auth, BrandLogo default          |
| `vortice-full.svg` (ou .png)     | Símbolo + texto VÓRTICE + tagline. Usado em: tela de login, |
|                                  | aguardando ativação, página de branding (preview)           |

## Recomendações técnicas

- **Formato preferido**: SVG (vetor, escala perfeita)
- **Se PNG**: pelo menos 1024×1024 pro símbolo, e 1500×400 pra versão completa,
  fundo transparente
- **Cores**: o site é dark (`bg #0A0F1E`); use lima `#A3E635` + violeta `#A78BFA`
  com versões que tenham contraste sobre fundo escuro

## Como trocar

1. Salve os 2 arquivos aqui em `public/brand/` mantendo os nomes acima
2. Se for PNG, atualize a extensão em `src/components/brand/VorticeLogo.tsx`
   (constantes `SYMBOL_SRC` e `FULL_SRC`)
3. Reinicie `npm run dev` (Vite pega novos arquivos no `public/` automaticamente)
