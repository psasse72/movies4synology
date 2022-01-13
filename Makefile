# Retrieve the UUID from ``metadata.json``
UUID = $(shell grep -E '^[ ]*"uuid":' ./metadata.json | sed 's@^[ ]*"uuid":[ ]*"\(.\+\)",[ ]*@\1@')

ifeq ($(strip $(DESTDIR)),)
INSTALLBASE = $(HOME)/.local/share/gnome-shell/extensions
else
INSTALLBASE = $(DESTDIR)/usr/share/gnome-shell/extensions
endif
INSTALLNAME = $(UUID)

$(info UUID is "$(UUID)")

.PHONY: all clean install zip-file

sources = src/*.ts stylesheet.css

all: depcheck compile

clean:
	rm -rf _build

transpile: $(sources)
	tsc

compile: convert metadata.json
	rm -rf _build
	mkdir -p _build
	glib-compile-schemas schemas/. 
	cp -r icon.svg metadata.json target/*.js src/prefs.js src/prefs.ui stylesheet.css schemas _build

convert: transpile
	for file in target/*.js; do \
		sed -i \
			-e 's#export function#function#g' \
			-e 's#export var#var#g' \
			-e 's#export const#var#g' \
			-e 's#Object.defineProperty(exports, "__esModule", { value: true });#var exports = {};#g' \
			"$${file}"; \
		sed -i -E 's/export class (\w+)/var \1 = class \1/g' "$${file}"; \
		sed -i -E "s/import \* as (\w+) from '(\w+)'/const \1 = Me.imports.\2/g" "$${file}"; \
	done

depcheck:
	@if ! command -v tsc >/dev/null; then \
		echo 'You must install TypeScript >= 3.8 to transpile: (node-typescript on Debian systems)'; \
		exit 1; \
	fi

enable:
	gnome-extensions enable ${UUID}

disable:
	gnome-extensions disable ${UUID}

listen:
	journalctl -o cat -n 0 -f "$$(which gnome-shell)"

install:
	rm -rf $(INSTALLBASE)/$(INSTALLNAME)
	mkdir -p $(INSTALLBASE)/$(INSTALLNAME)
	cp -r _build/* $(INSTALLBASE)/$(INSTALLNAME)/
	cp -r schemas $(INSTALLBASE)/$(INSTALLNAME)/.

uninstall:
	rm -rf $(INSTALLBASE)/$(INSTALLNAME)

restart-shell:
	echo "Restart shell!"
	if bash -c 'xprop -root &> /dev/null'; then \
		busctl --user call org.gnome.Shell /org/gnome/Shell org.gnome.Shell Eval s 'Meta.restart("Restarting Gnome...")'; \
	else \
		gnome-session-quit --logout; \
	fi

zip-file: all
	cd _build && zip -qr "../$(UUID)$(VSTRING).zip" .

