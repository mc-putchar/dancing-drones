#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include "driver/uart.h"
#include "esp_err.h"
#include "esp_log.h"
#include "esp_mac.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#define UART_NUM UART_NUM_1
#ifndef CONFIG_DD_GPIO_TX_PIN
# define CONFIG_DD_GPIO_TX_PIN (32)
#endif
#ifndef CONFIG_DD_GPIO_RX_PIN
# define CONFIG_DD_GPIO_RX_PIN (33)
#endif
#define TXD_PIN CONFIG_DD_GPIO_TX_PIN
#define RXD_PIN CONFIG_DD_GPIO_RX_PIN
#define BUF_SIZE (1024)
// SBUS Protocol Constants
#define SBUS_HEADER 0x0F
#define SBUS_END 0x00

#define CHANNEL_MASK(x) (x & 0x07FF)
#define MIN_VAL (172)
#define MID_VAL (992)
#define MAX_VAL (1800)

void init_uart_sbus()
{
    const uart_config_t uart_config = {
        .baud_rate = 100000,
        .data_bits = UART_DATA_8_BITS,
        .parity = UART_PARITY_EVEN,
        .stop_bits = UART_STOP_BITS_2,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,
    };

    // Configure UART parameters
    uart_param_config(UART_NUM, &uart_config);

    // Set UART pins
    uart_set_pin(UART_NUM, TXD_PIN, RXD_PIN, UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE);

    // Install UART driver
    ESP_ERROR_CHECK(uart_driver_install(UART_NUM, BUF_SIZE * 2, BUF_SIZE * 2, 0, NULL, 0));

}

void send_sbus_data()
{
    uint8_t sbus_data[25] = {0};
    uint16_t channels[16] = {0}; // Initialize all channels to 0

    // Set values for the first 5 channels
    channels[0] = 992; // Unique value for channel 1 (throttle?) roll
    channels[1] = 1800; // Unique value for channel 2 (roll?) pitch
    channels[2] = 172; // Unique value for channel 3 (pitch?) throttle
    channels[3] = 1700; // Unique value for channel 4 (yaw?) yaw
    channels[4] = 1800;
    channels[5] = 1500;

    // if (armed)
    //     channels[4] = 1800;
    // else
    //     channels[4] = 172;

    // Pack 16 channels (11 bits each) into the sbus_data array
    sbus_data[0] = SBUS_HEADER; // SBUS header byte
    sbus_data[1] = (CHANNEL_MASK(channels[0]));
    sbus_data[2] = (CHANNEL_MASK(channels[0]) >> 8) | ((CHANNEL_MASK(channels[1])) << 3);
    sbus_data[3] = (CHANNEL_MASK(channels[1]) >> 5 | CHANNEL_MASK(channels[2] << 6));
    sbus_data[4] = (CHANNEL_MASK(channels[2]) >> 2);
    sbus_data[5] = (CHANNEL_MASK(channels[2]) >> 10) | ((CHANNEL_MASK(channels[3])) << 1);
    sbus_data[6] = (CHANNEL_MASK(channels[3]) >> 7) | (CHANNEL_MASK(channels[4]) << 4);
    sbus_data[7] = (CHANNEL_MASK(channels[4]) >> 4) | ((CHANNEL_MASK(channels[5])) << 7);
    sbus_data[8] = (CHANNEL_MASK(channels[5]) >> 1);
    sbus_data[9] = (CHANNEL_MASK(channels[5]) >> 9) | ((CHANNEL_MASK(channels[6])) << 2);
    sbus_data[10] = (CHANNEL_MASK(channels[6]) >> 6) | ((CHANNEL_MASK(channels[7])) << 5);
    sbus_data[11] = (CHANNEL_MASK(channels[7]) >> 3);
    sbus_data[12] = (CHANNEL_MASK(channels[8]));
    sbus_data[13] = (CHANNEL_MASK(channels[8]) >> 8) | (CHANNEL_MASK(channels[9]) << 3);
    sbus_data[14] = (CHANNEL_MASK(channels[9]) >> 5) | (CHANNEL_MASK(channels[10]) << 6);
    sbus_data[15] = (CHANNEL_MASK(channels[10]) >> 2);
    sbus_data[16] = (CHANNEL_MASK(channels[10]) >> 10) | (CHANNEL_MASK(channels[11]) << 1);
    sbus_data[17] = (CHANNEL_MASK(channels[11]) >> 7) | ((CHANNEL_MASK(channels[12])) << 4);
    sbus_data[18] = (CHANNEL_MASK(channels[12]) >> 4) | ((CHANNEL_MASK(channels[13])) << 7);
    sbus_data[19] = (CHANNEL_MASK(channels[13]) >> 1);
    sbus_data[20] = (CHANNEL_MASK(channels[13]) >> 9) | ((CHANNEL_MASK(channels[14])) << 2);
    sbus_data[21] = (CHANNEL_MASK(channels[14]) >> 6) | (CHANNEL_MASK(channels[15]) << 5);
    sbus_data[22] = (CHANNEL_MASK(channels[15]) >> 3);
    sbus_data[23] = 0x03;
    sbus_data[24] = SBUS_END; // Flags byte

    uart_write_bytes(UART_NUM, (const char *)sbus_data, 25);
}

void uart_sbus_task(void *arg)
{
    // uint8_t data[BUF_SIZE];
    while (1) {
        send_sbus_data();
        // // Read data from UART
        // int length = uart_read_bytes(UART_NUM, data, BUF_SIZE, 20 / portTICK_PERIOD_MS);
        // if (length > 0) {
        //     // Print received data
        //     ESP_LOGI(TAG, "Received data: %.*s", length, data);
        // }
        vTaskDelay(20 / portTICK_PERIOD_MS); // SBUS frame rate is typically 50Hz (20ms period)
    }
}

// void app_main(void) {
//     // Initialize UART
//     init_uart_sbus();

//     // Create a task to handle SBUS communication
//     xTaskCreate(uart_task, "uart_task", 2048, NULL, 10, NULL);
// }
