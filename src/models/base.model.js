// src/models/base.model.js
const { pool } = require('../config/database');

class BaseModel {
    constructor(table) {
        this.table = table;
        this.pool = pool;
    }

    /**
     * Find all records
     * @param {Object} options - Query options
     * @returns {Promise<Array>} - Array of records
     */
    async findAll(options = {}) {
        const { 
            select = '*', 
            where = '', 
            orderBy = '', 
            limit = null 
        } = options;

        let query = `SELECT ${select} FROM ${this.table}`;
        
        if (where) {
            query += ` WHERE ${where}`;
        }
        
        if (orderBy) {
            query += ` ORDER BY ${orderBy}`;
        }
        
        if (limit) {
            query += ` LIMIT ${limit}`;
        }

        try {
            const [rows] = await this.pool.execute(query);
            return rows;
        } catch (error) {
            console.error(`Error in findAll for ${this.table}:`, error);
            throw error;
        }
    }

    /**
     * Find by primary key
     * @param {number|string} id - Primary key value
     * @returns {Promise<Object|null>} - Found record or null
     */
    async findByPk(id) {
        try {
            const [rows] = await this.pool.execute(
                `SELECT * FROM ${this.table} WHERE id = ?`, 
                [id]
            );
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error(`Error in findByPk for ${this.table}:`, error);
            throw error;
        }
    }

    /**
     * Create a new record
     * @param {Object} data - Record data
     * @returns {Promise<Object>} - Created record
     */
    async create(data) {
        const columns = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const values = Object.values(data);

        try {
            const [result] = await this.pool.execute(
                `INSERT INTO ${this.table} (${columns}) VALUES (${placeholders})`,
                values
            );

            return {
                id: result.insertId,
                ...data
            };
        } catch (error) {
            console.error(`Error in create for ${this.table}:`, error);
            throw error;
        }
    }

    /**
     * Update a record
     * @param {number|string} id - Record ID
     * @param {Object} data - Updated data
     * @returns {Promise<Object>} - Updated record
     */
    async update(id, data) {
        const updateFields = Object.keys(data)
            .map(key => `${key} = ?`)
            .join(', ');
        const values = [...Object.values(data), id];

        try {
            await this.pool.execute(
                `UPDATE ${this.table} SET ${updateFields} WHERE id = ?`,
                values
            );

            return this.findByPk(id);
        } catch (error) {
            console.error(`Error in update for ${this.table}:`, error);
            throw error;
        }
    }

    /**
     * Delete a record
     * @param {number|string} id - Record ID
     * @returns {Promise<boolean>} - Deletion success
     */
    async delete(id) {
        try {
            const [result] = await this.pool.execute(
                `DELETE FROM ${this.table} WHERE id = ?`, 
                [id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error(`Error in delete for ${this.table}:`, error);
            throw error;
        }
    }

    /**
     * Custom query method
     * @param {string} query - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<Array>} - Query results
     */
    async query(query, params = []) {
        try {
            const [rows] = await this.pool.execute(query, params);
            return rows;
        } catch (error) {
            console.error('Custom query error:', error);
            throw error;
        }
    }
}

module.exports = BaseModel;