# Must match the @cloudflare/sandbox version in package.json.
FROM docker.io/cloudflare/sandbox:0.12.10-python

# Document tools for files the bot creates. Runtime internet is off, so anything
# it needs has to be in the image. LibreOffice turns Word files into PDFs with
# correct Thai; WeasyPrint overlapped text on this base image.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends fonts-thai-tlwg libreoffice-writer poppler-utils \
	&& rm -rf /var/lib/apt/lists/* \
	&& python3 -m pip install --no-cache-dir python-docx openpyxl

# Anthropic's docx skill builds Word files with docx-js; pdftoppm (poppler) renders pages to check them.
RUN npm install -g docx@9.5.1
ENV NODE_PATH=/usr/local/lib/node_modules

# Sarabun (OFL) is the house font for files the bot makes.
COPY fonts/sarabun /usr/share/fonts/truetype/sarabun
RUN fc-cache -f

RUN mkdir -p /workspace
