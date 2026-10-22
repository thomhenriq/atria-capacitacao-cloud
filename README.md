# Atria Cloud ☁️✦

Site estático do **workshop de Cloud da Atria Jr**, feito para ser hospedado no
**Amazon S3** com *static website hosting*. Não tem build, framework nem
dependências: são só arquivos HTML, CSS e JS.

O card **deploy.status** no topo da página detecta de onde o site está sendo
servido. Aberto localmente, ele mostra “Rodando localmente”. Depois do deploy no
S3, ele passa a mostrar **“Você está no ar!”**, junto com o bucket, a região, o
protocolo e o horário do upload.

## Estrutura

```
.
├── index.html             # página principal
├── error.html             # error document do S3 (404 “Perdido nas nuvens”)
├── assets/
│   ├── styles.css
│   ├── main.js
│   ├── favicon.svg
│   ├── clouds-back.svg    # camadas de nuvens do hero
│   ├── clouds-front.svg
│   └── atria-logo-branco.webp
├── bucket-policy.json     # policy de leitura pública (troque NOME-DO-BUCKET)
└── README.md
```

## Rodar localmente

Dá para abrir o `index.html` direto no navegador. Para testar também o
`error.html`, que usa caminhos absolutos, suba um servidor na raiz do projeto:

```bash
python3 -m http.server 8080
# http://localhost:8080
```

## Deploy pelo Console da AWS

1. **S3 → Create bucket.** O nome precisa ser único no mundo, por exemplo
   `atria-cloud-seunome`. Use a região `sa-east-1` (São Paulo).
2. **Permissions → Block public access → Edit.** Desmarque *Block all public
   access*, salve e digite `confirm`.
3. **Permissions → Bucket policy → Edit.** Cole o conteúdo de
   `bucket-policy.json`, trocando `NOME-DO-BUCKET` pelo nome do seu bucket.
4. **Properties → Static website hosting → Edit → Enable.** Use `index.html`
   como index document e `error.html` como error document.
5. **Objects → Upload.** Envie o `index.html`, o `error.html` e a pasta
   `assets/`. O `index.html` precisa ficar na raiz do bucket.
6. Acesse o **Bucket website endpoint**, que fica em Properties → Static website
   hosting. Em `sa-east-1`, ele tem este formato:
   `http://SEU-BUCKET.s3-website-sa-east-1.amazonaws.com`

> 💡 A seção “Passo a passo” do próprio site tem um campo para digitar o nome do
> bucket. A policy, os comandos e o endpoint se atualizam com esse nome, prontos
> para copiar.

## Deploy pela AWS CLI

Este roteiro precisa da [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
configurada com `aws configure`. Rode os comandos na raiz do projeto:

```bash
BUCKET=atria-cloud-seunome
REGION=sa-east-1

aws s3 mb s3://$BUCKET --region $REGION

aws s3api put-public-access-block --bucket $BUCKET \
  --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

aws s3api put-bucket-policy --bucket $BUCKET \
  --policy "$(sed "s/NOME-DO-BUCKET/$BUCKET/" bucket-policy.json)"

aws s3 website s3://$BUCKET --index-document index.html --error-document error.html

aws s3 sync . s3://$BUCKET --exclude "*" --include "*.html" --include "assets/*"

echo "http://$BUCKET.s3-website-$REGION.amazonaws.com"
```

Esse `echo` monta o endpoint com hífen, que é o formato de `sa-east-1` e
`us-east-1`. Regiões mais novas, como `us-east-2`, usam ponto:
`s3-website.us-east-2`.

## Limpeza depois do workshop

O bucket só gera custo enquanto existir. Para apagá-lo com todo o conteúdo:

```bash
aws s3 rb s3://$BUCKET --force
```

## Próximos passos

- **CloudFront** na frente do bucket, para ter HTTPS e cache global.
- **Route 53** para usar um domínio próprio.
- **GitHub Actions** para rodar o `aws s3 sync` a cada `git push`.

---

Feito pela [Atria Jr](https://atriajr.com.br/), a Empresa Júnior da Faculdade de
Tecnologia da UNICAMP.
