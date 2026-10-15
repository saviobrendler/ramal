<?php
/**
 * Plugin Name:       Ramal — trens do Rio
 * Plugin URI:        https://trensrj.com.br/
 * Description:       Próximos trens, horários, planejador de viagem, vagão certo e avisos dos trens do Rio de Janeiro. Use o shortcode [ramal].
 * Version:           0.5.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Ramal (projeto independente)
 * License:           GPL-2.0-or-later
 * Text Domain:       ramal
 */

if (!defined('ABSPATH')) {
    exit;
}

const RAMAL_OPTION = 'ramal_api_url';

/**
 * Shortcode [ramal height="900"]
 * Mostra o app dentro de uma janela (iframe), para não misturar o CSS dele com o do seu tema.
 */
function ramal_shortcode($atts) {
    $atts = shortcode_atts(['height' => '900'], $atts, 'ramal');
    $height = max(480, min(2000, (int) $atts['height']));

    $src = plugins_url('app/index.html', __FILE__);
    $api = trim((string) get_option(RAMAL_OPTION, ''));
    if ($api !== '') {
        $src = add_query_arg('api', $api, $src);
    }

    return sprintf(
        '<iframe src="%s" title="%s" loading="lazy" style="width:100%%;height:%dpx;border:0;border-radius:16px;max-width:1040px;display:block;margin:0 auto;" allow="geolocation 0"></iframe>',
        esc_url($src),
        esc_attr__('Ramal — trens do Rio', 'ramal'),
        $height
    );
}
add_shortcode('ramal', 'ramal_shortcode');

/* ---------- Página de configuração: Ajustes > Ramal ---------- */

function ramal_admin_menu() {
    add_options_page(
        __('Ramal', 'ramal'),
        __('Ramal', 'ramal'),
        'manage_options',
        'ramal',
        'ramal_settings_page'
    );
}
add_action('admin_menu', 'ramal_admin_menu');

function ramal_register_settings() {
    register_setting('ramal', RAMAL_OPTION, [
        'type' => 'string',
        'sanitize_callback' => 'ramal_sanitize_api_url',
        'default' => '',
    ]);
}
add_action('admin_init', 'ramal_register_settings');

function ramal_sanitize_api_url($value) {
    $value = trim((string) $value);
    if ($value === '') {
        return '';
    }
    $clean = esc_url_raw($value, ['https', 'http']);
    if ($clean === '') {
        add_settings_error('ramal', 'ramal_bad_url', __('Endereço inválido. Use http:// ou https://.', 'ramal'));
        return (string) get_option(RAMAL_OPTION, '');
    }
    return rtrim($clean, '/') . '/';
}

function ramal_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    ?>
    <div class="wrap">
        <h1><?php esc_html_e('Ramal — configurações', 'ramal'); ?></h1>
        <p><?php esc_html_e('Coloque o shortcode [ramal] em qualquer página ou post para mostrar o app.', 'ramal'); ?></p>
        <form method="post" action="options.php">
            <?php settings_fields('ramal'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="ramal_api_url"><?php esc_html_e('Endereço do servidor Ramal', 'ramal'); ?></label></th>
                    <td>
                        <input type="url" class="regular-text" id="ramal_api_url" name="<?php echo esc_attr(RAMAL_OPTION); ?>"
                               value="<?php echo esc_attr(get_option(RAMAL_OPTION, '')); ?>" placeholder="https://ramal.seu-dominio.com/">
                        <p class="description">
                            <?php esc_html_e('Endereço do servidor Node do Ramal (onde ficam os relatos, os avisos e o tempo real). Sem ele, o app funciona com os horários e estações, mas sem relatos, lotação, vagão certo e avisos.', 'ramal'); ?>
                        </p>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}
