# Must match the @cloudflare/sandbox version in package.json.
FROM docker.io/cloudflare/sandbox:0.12.10-python

# Document tools for files the bot creates. Runtime internet is off, so anything
# it needs has to be in the image. LibreOffice turns Word files into PDFs with
# correct Thai; WeasyPrint overlapped text on this base image.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends fonts-thai-tlwg libreoffice-writer \
	&& rm -rf /var/lib/apt/lists/* \
	&& python3 -m pip install --no-cache-dir python-docx openpyxl

RUN mkdir -p /workspace
