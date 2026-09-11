FROM php:8.2-fpm-alpine

ARG UID=1000
ARG GID=1000

# Instalación de dependencias del sistema (shadow permite usermod/groupmod en Alpine)
RUN apk add --no-cache \
    freetype-dev \
    libjpeg-turbo-dev \
    libpng-dev \
    libwebp-dev \
    libzip-dev \
    sqlite-dev \
    zip \
    unzip \
    git \
    oniguruma-dev \
    shadow

# Alinear UID/GID de www-data y crear su home para cache de Composer
RUN (groupmod -g ${GID} www-data 2>/dev/null || true) \
    && (usermod -u ${UID} -g www-data www-data 2>/dev/null || true) \
    && mkdir -p /home/www-data/.composer \
    && chown -R www-data:www-data /home/www-data

# Configuración e instalación de extensiones PHP
RUN docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j$(nproc) pdo_mysql pdo_sqlite gd zip bcmath mbstring

# Configuración personalizada de PHP
COPY docker/php/custom.ini /usr/local/etc/php/conf.d/custom.ini

# Instalación de Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

EXPOSE 9000

CMD ["php-fpm"]