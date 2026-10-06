package iuh.fit.se.hotelmanagement_be.modular.promotion.repositories;

import iuh.fit.se.hotelmanagement_be.modular.promotion.entities.Promotion;
import iuh.fit.se.hotelmanagement_be.modular.promotion.enums.PromotionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PromotionRepository extends JpaRepository<Promotion, String> {

    Optional<Promotion> findByIdAndDeletedFalse(String id);

    boolean existsByCodeAndDeletedFalse(String code);

    boolean existsByCodeAndIdNotAndDeletedFalse(String code, String id);
    Optional<Promotion> findByCodeAndDeletedFalse(String code);
    @Query("""
            SELECT p FROM Promotion p
            WHERE p.deleted = false
              AND (p.hotel.id = :hotelId OR p.hotel IS NULL)
            ORDER BY p.createdAt DESC
            """)
    List<Promotion> findBranchAndSharedPromotions(@Param("hotelId") Long hotelId);
    @Query(value = """
        SELECT p.* FROM promotions p
        WHERE p.deleted = false
          AND (CAST(:hotelId AS bigint) IS NULL OR p.hotel_id = CAST(:hotelId AS bigint) OR p.hotel_id IS NULL)
          AND (CAST(:status AS varchar) IS NULL OR p.status = CAST(:status AS varchar))
          AND (CAST(:type AS varchar) IS NULL OR p.type = CAST(:type AS varchar))
          AND (CAST(:keyword AS varchar) IS NULL
               OR LOWER(p.name) LIKE LOWER(CONCAT('%', CAST(:keyword AS varchar), '%'))
               OR LOWER(p.code) LIKE LOWER(CONCAT('%', CAST(:keyword AS varchar), '%')))
          AND (CAST(:startDate AS timestamp) IS NULL OR p.start_date >= CAST(:startDate AS timestamp))
          AND (CAST(:endDate AS timestamp) IS NULL OR p.end_date <= CAST(:endDate AS timestamp))
        """, countQuery = """
        SELECT COUNT(p.id) FROM promotions p
        WHERE p.deleted = false
          AND (CAST(:hotelId AS bigint) IS NULL OR p.hotel_id = CAST(:hotelId AS bigint) OR p.hotel_id IS NULL)
          AND (CAST(:status AS varchar) IS NULL OR p.status = CAST(:status AS varchar))
          AND (CAST(:type AS varchar) IS NULL OR p.type = CAST(:type AS varchar))
          AND (CAST(:keyword AS varchar) IS NULL
               OR LOWER(p.name) LIKE LOWER(CONCAT('%', CAST(:keyword AS varchar), '%'))
               OR LOWER(p.code) LIKE LOWER(CONCAT('%', CAST(:keyword AS varchar), '%')))
          AND (CAST(:startDate AS timestamp) IS NULL OR p.start_date >= CAST(:startDate AS timestamp))
          AND (CAST(:endDate AS timestamp) IS NULL OR p.end_date <= CAST(:endDate AS timestamp))
        """, nativeQuery = true)
    Page<Promotion> findAllWithFilters(
            @Param("hotelId") Long hotelId,
            @Param("status") String status,
            @Param("type") String type,
            @Param("keyword") String keyword,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            Pageable pageable
    );

    List<Promotion> findAllByStatusAndDeletedFalseOrderByCreatedAtDesc(PromotionStatus status);

    @Modifying
    @Query("""
            UPDATE Promotion p
            SET p.status = 'EXPIRED', p.updatedAt = :now
            WHERE p.deleted = false
              AND p.status = 'ACTIVE'
              AND p.endDate < :now
            """)
    int bulkExpirePromotions(@Param("now") LocalDateTime now);
}
