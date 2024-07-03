#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/uart.h"
#include "esp_log.h"
#include "cJSON.h"

#define UART_NUM UART_NUM_0
#define BUF_SIZE (1024)

static const char *TAG = "uart_json";

void init_uart()
{
    const uart_config_t uart_config = {
        .baud_rate = 115200,
        .data_bits = UART_DATA_8_BITS,
        .parity = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,
    };

    // Configure UART parameters
    uart_param_config(UART_NUM, &uart_config);

    // Install UART driver
    ESP_ERROR_CHECK(uart_driver_install(UART_NUM, BUF_SIZE * 2, BUF_SIZE * 2, 0, NULL, 0));
}

// Parse JSON data
void parse_json(const char *json_data)
{
    cJSON *root = cJSON_Parse(json_data);
    if (root == NULL) {
        ESP_LOGE(TAG, "Failed to parse JSON");
        return;
    }

    int armed = cJSON_GetObjectItem(root, "armed")->valueint;
    if (armed)
        ESP_LOGI(TAG, "ARM: %d", armed);
    // Example: Print parsed JSON data
    char *string = cJSON_Print(root);
    if (string != NULL) {
        ESP_LOGI(TAG, "Parsed JSON data:\n%s", string);
        free(string);
    }

    cJSON_Delete(root);
}

// Task to read UART data and parse JSON
void uart_task(void *arg)
{
    uint8_t data[BUF_SIZE];
    while (1) {
        // Read data from UART
        int length = uart_read_bytes(UART_NUM, data, BUF_SIZE - 1, 20 / portTICK_PERIOD_MS);
        if (length > 0) {
            data[length] = '\0';
            int drone_index = *data - '0';
            ESP_LOGI(TAG, "Drone: %d\nReceived data: %s", drone_index, data);
            parse_json((const char *)(data + 1));
        }
        vTaskDelay(100 / portTICK_PERIOD_MS);
    }
}

// void app_main(void) {
//     // Initialize UART
//     init_uart();

//     // Create a task to handle UART communication
//     xTaskCreate(uart_task, "uart_task", 4096, NULL, 10, NULL);
// }
