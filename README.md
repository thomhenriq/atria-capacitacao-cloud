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
├── iam-policy-participantes.json  # IAM policy dos usuários do workshop
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

1. **S3 → Create bucket.** O nome precisa seguir o padrão
   `lab-<seu-usuario-iam>-<sufixo>`, por exemplo `lab-thom-site`. Use a região
   `sa-east-1` (São Paulo). Com outro nome, a AWS responde *Access Denied*:
   veja [Para o instrutor](#para-o-instrutor).
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

> 💡 Na seção “Passo a passo” do próprio site, cada participante digita o
> usuário IAM e um sufixo. O site monta o nome do bucket e atualiza a policy, os
> comandos e o endpoint, prontos para copiar.

## Deploy pela AWS CLI

Este roteiro precisa da [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
configurada com `aws configure`. Rode os comandos na raiz do projeto:

```bash
USUARIO=$(aws sts get-caller-identity --query Arn --output text | cut -d/ -f2)
BUCKET=lab-$USUARIO-site
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

## Para o instrutor

Cada participante entra com um usuário IAM próprio, que tem a policy
[`iam-policy-participantes.json`](iam-policy-participantes.json). Ela só libera
o S3 em buckets que começam com `lab-${aws:username}-`. Na hora de avaliar o
pedido, a AWS troca a variável `${aws:username}` pelo nome do usuário logado.
Assim, uma única policy serve para a turma toda, e ninguém mexe no bucket de
outra pessoa.

Antes do workshop, confira dois pontos:

- **Nomes de usuário em minúsculas, sem `_`, `@` ou `+`.** Nomes de bucket só
  aceitam minúsculas, números, pontos e hífens. Um usuário `Thom` nunca
  conseguiria criar um bucket que bata com `lab-Thom-*`.
- **Block Public Access da conta desligado.** Os participantes só conseguem
  liberar o acesso público no próprio bucket. Se o bloqueio estiver ligado na
  conta (ou imposto pela AWS Organizations), o `PutBucketPolicy` com leitura
  pública é recusado mesmo assim.

## Próximos passos

- **CloudFront** na frente do bucket, para ter HTTPS e cache global.
- **Route 53** para usar um domínio próprio.
- **GitHub Actions** para rodar o `aws s3 sync` a cada `git push`.

---

Feito pela [Atria Jr](https://atriajr.com.br/), a Empresa Júnior da Faculdade de
Tecnologia da UNICAMP.
