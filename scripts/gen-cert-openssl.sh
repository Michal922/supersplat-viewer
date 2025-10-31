#!/usr/bin/env bash
set -euo pipefail

IP="${1:-}"
if [ -z "$IP" ]; then
  echo "Użycie: npm run gen-cert -- <TWOJE_IP_W_LAN>"
  exit 1
fi

ROOT="$(pwd)"
CERT_DIR="$ROOT/certs"
PUB_DIR="$ROOT/public"

mkdir -p "$CERT_DIR" "$PUB_DIR" "$PUB_DIR/setup"

OPENSSL_CFG="$CERT_DIR/openssl.cnf"

# Minimalne CA + cert serwera z SAN = localhost + IP
cat > "$OPENSSL_CFG" <<'EOF'
[ ca ]
default_ca = CA_default

[ CA_default ]
dir               = .
new_certs_dir     = .
database          = index.txt
serial            = serial
default_md        = sha256
policy            = policy_any
x509_extensions   = v3_ca

[ policy_any ]
commonName              = supplied
organizationName        = optional
countryName             = optional

[ req ]
default_bits       = 2048
distinguished_name = dn
x509_extensions    = v3_ca
prompt             = no
default_md         = sha256

[ dn ]
C  = PL
O  = Supersplat 3D Dev
CN = Supersplat 3D Local Dev CA

[ v3_ca ]
basicConstraints = critical,CA:TRUE
keyUsage         = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer

[ v3_server ]
basicConstraints = CA:FALSE
keyUsage         = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName   = @alt_names

[ alt_names ]
DNS.1 = localhost
IP.1  = 127.0.0.1
# IP.2 wstrzykniemy niżej w sed
EOF

touch "$CERT_DIR/index.txt"
[ -f "$CERT_DIR/serial" ] || echo 1000 > "$CERT_DIR/serial"

# 1) Root CA
if [ ! -f "$CERT_DIR/rootCA.pem" ]; then
  openssl req -x509 -new -nodes -days 3650 \
    -config "$OPENSSL_CFG" \
    -keyout "$CERT_DIR/rootCA.key" \
    -out "$CERT_DIR/rootCA.pem" >/dev/null 2>&1
  echo "✔ Wygenerowano CA: certs/rootCA.pem"
fi

# 2) Server key
openssl genrsa -out "$CERT_DIR/server.key" 2048 >/dev/null 2>&1

# 3) CSR
cat > "$CERT_DIR/server.req.cnf" <<'EOF'
[ req ]
default_bits       = 2048
prompt             = no
default_md         = sha256
distinguished_name = dn
req_extensions     = v3_server

[ dn ]
C  = PL
O  = Supersplat 3D Dev
CN = localhost

[ v3_server ]
basicConstraints = CA:FALSE
keyUsage         = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName   = @alt_names

[ alt_names ]
DNS.1 = localhost
IP.1  = 127.0.0.1
# IP.2 dokleimy niżej
EOF

# wstrzykujemy IP użytkownika do obu plików
sed -i '' "s/# IP\.2.*/IP.2  = ${IP}/" "$OPENSSL_CFG" || sed -i "s/# IP\.2.*/IP.2  = ${IP}/" "$OPENSSL_CFG"
sed -i '' "s/# IP\.2 dokleimy niżej/IP.2  = ${IP}/" "$CERT_DIR/server.req.cnf" || sed -i "s/# IP\.2 dokleimy niżej/IP.2  = ${IP}/" "$CERT_DIR/server.req.cnf"

openssl req -new -key "$CERT_DIR/server.key" \
  -out "$CERT_DIR/server.csr" \
  -config "$CERT_DIR/server.req.cnf" >/dev/null 2>&1

# 4) Podpis certu serwera
openssl x509 -req -in "$CERT_DIR/server.csr" -days 825 \
  -CA "$CERT_DIR/rootCA.pem" -CAkey "$CERT_DIR/rootCA.key" -CAcreateserial \
  -out "$CERT_DIR/server.pem" \
  -extfile "$OPENSSL_CFG" -extensions v3_server >/dev/null 2>&1

# 5) CA do pobrania (DER .cer)
openssl x509 -in "$CERT_DIR/rootCA.pem" -outform der -out "$PUB_DIR/rootCA.cer"

echo
echo "✅ Certy gotowe:"
echo "  certs/server.pem  (cert serwera)"
echo "  certs/server.key  (klucz serwera)"
echo "  public/rootCA.cer (zainstaluj na iOS/Android)"
echo
echo "👉 Start: npm run serve-dual"
echo "👉 iPhone: https://${IP}:3443/setup → Pobierz certyfikat (.cer) → Ustawienia → Ogólne → Informacje → Ustawienia zaufania certyfikatów → włącz przełącznik dla 'Supersplat 3D Local Dev CA'"